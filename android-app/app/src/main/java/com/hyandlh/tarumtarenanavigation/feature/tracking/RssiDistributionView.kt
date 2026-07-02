package com.hyandlh.tarumtarenanavigation.feature.tracking

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View

class RssiDistributionView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.BLUE
        style = Paint.Style.FILL
    }

    private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.RED
        strokeWidth = 4f
        style = Paint.Style.STROKE
    }

    private val axisPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.LTGRAY
        strokeWidth = 2f
    }

    private var rssiFrequencies: Map<Int, Int> = emptyMap()
    private var latestRssi: Int? = null
    private var isGrayedOut: Boolean = false

    private val minRssi = -100
    private val maxRssi = -30

    fun setData(frequencies: Map<Int, Int>, latest: Int?, grayedOut: Boolean) {
        this.rssiFrequencies = frequencies
        this.latestRssi = latest
        this.isGrayedOut = grayedOut
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val w = width.toFloat()
        val h = height.toFloat()

        // Draw X-axis
        canvas.drawLine(0f, h - 5f, w, h - 5f, axisPaint)

        if (rssiFrequencies.isEmpty() && latestRssi == null) return

        val maxFreq = rssiFrequencies.values.maxOrNull()?.toFloat() ?: 1f
        
        // Adjust colors for grayed out state
        dotPaint.color = if (isGrayedOut) Color.LTGRAY else Color.BLUE
        linePaint.color = if (isGrayedOut) Color.GRAY else Color.RED

        // Draw dots
        rssiFrequencies.forEach { (rssi, freq) ->
            val x = rssiToX(rssi, w)
            val y = freqToY(freq, h, maxFreq)
            canvas.drawCircle(x, y, 6f, dotPaint)
        }

        // Draw vertical line for latest RSSI
        latestRssi?.let { rssi ->
            val x = rssiToX(rssi, w)
            canvas.drawLine(x, 0f, x, h, linePaint)
        }
    }

    private fun rssiToX(rssi: Int, width: Float): Float {
        val clampedRssi = rssi.coerceIn(minRssi, maxRssi)
        return (clampedRssi - minRssi).toFloat() / (maxRssi - minRssi) * width
    }

    private fun freqToY(freq: Int, height: Float, maxFreq: Float): Float {
        // Leave some margin at the top and bottom
        val margin = 10f
        val availableHeight = height - 2 * margin
        return height - margin - (freq.toFloat() / maxFreq * availableHeight)
    }
}
