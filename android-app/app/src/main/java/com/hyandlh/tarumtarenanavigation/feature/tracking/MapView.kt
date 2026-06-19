package com.hyandlh.tarumtarenanavigation.feature.tracking

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.PointF
import android.graphics.RectF
import android.graphics.drawable.BitmapDrawable
import android.util.AttributeSet
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import androidx.core.content.ContextCompat
import com.hyandlh.tarumtarenanavigation.core.common.CoordinateConverter
import com.hyandlh.tarumtarenanavigation.core.model.AccessPointLocation
import com.hyandlh.tarumtarenanavigation.core.model.PositionEstimate
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanReading
import kotlin.math.pow
import kotlin.math.sqrt

class MapView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private var mapImageRes: Int = 0
    private var imageMatrix = Matrix()
    private var inverseMatrix = Matrix()

    private val userPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.BLUE
        style = Paint.Style.FILL
    }

    private val apPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.RED
        style = Paint.Style.FILL
    }

    private val apLabelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.BLACK
        textSize = 30f
        textAlign = Paint.Align.CENTER
    }

    private val circlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.GRAY
        style = Paint.Style.STROKE
        strokeWidth = 3f
        pathEffect = DashPathEffect(floatArrayOf(10f, 10f), 0f)
    }

    private val errorPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.RED
        textSize = 40f
        textAlign = Paint.Align.CENTER
    }

    private var userPosition: PositionEstimate? = null
    private var apLocations: List<AccessPointLocation> = emptyList()
    private var latestReadings: Map<String, WifiScanReading> = emptyMap()
    private var isDebugMode: Boolean = false
    private var coordinateConverter: CoordinateConverter? = null

    var onApClickListener: ((AccessPointLocation, WifiScanReading?) -> Unit)? = null

    private val scaleGestureDetector = ScaleGestureDetector(context, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScale(detector: ScaleGestureDetector): Boolean {
            val scaleFactor = detector.scaleFactor
            imageMatrix.postScale(scaleFactor, scaleFactor, detector.focusX, detector.focusY)
            invalidate()
            return true
        }
    })

    private val gestureDetector = GestureDetector(context, object : GestureDetector.SimpleOnGestureListener() {
        override fun onScroll(e1: MotionEvent?, e2: MotionEvent, distanceX: Float, distanceY: Float): Boolean {
            imageMatrix.postTranslate(-distanceX, -distanceY)
            invalidate()
            return true
        }

        override fun onSingleTapUp(e: MotionEvent): Boolean {
            if (isDebugMode) {
                handleSingleTap(e.x, e.y)
            }
            return true
        }
    })

    fun setMapImage(resId: Int) {
        this.mapImageRes = resId
        invalidate()
    }

    fun setCoordinateConverter(converter: CoordinateConverter) {
        this.coordinateConverter = converter
    }

    fun setUserPosition(position: PositionEstimate?) {
        this.userPosition = position
        invalidate()
    }

    fun setApLocations(locations: List<AccessPointLocation>) {
        this.apLocations = locations
        invalidate()
    }

    fun setLatestReadings(readings: List<WifiScanReading>) {
        this.latestReadings = readings.associateBy { it.bssid }
        invalidate()
    }

    fun setDebugMode(enabled: Boolean) {
        this.isDebugMode = enabled
        invalidate()
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        scaleGestureDetector.onTouchEvent(event)
        gestureDetector.onTouchEvent(event)
        return true
    }

    private fun handleSingleTap(x: Float, y: Float) {
        val converter = coordinateConverter ?: return
        
        // Convert screen tap to image coordinates
        val pts = floatArrayOf(x, y)
        imageMatrix.invert(inverseMatrix)
        inverseMatrix.mapPoints(pts)
        val imageX = pts[0]
        val imageY = pts[1]

        // Find closest AP
        for (ap in apLocations) {
            val (apPxX, apPxY) = converter.toPixels(ap.x, ap.y)
            val dist = sqrt((imageX - apPxX).pow(2) + (imageY - apPxY).pow(2))
            
            // If within 40 pixels radius of the AP dot
            if (dist < 40f) {
                onApClickListener?.invoke(ap, latestReadings[ap.bssid])
                break
            }
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        
        if (mapImageRes == 0) {
            drawErrorMessage(canvas, "Map image resource not found")
            return
        }

        val drawable = ContextCompat.getDrawable(context, mapImageRes)
        if (drawable is BitmapDrawable) {
            canvas.save()
            canvas.concat(imageMatrix)
            
            // Draw the map image
            drawable.setBounds(0, 0, drawable.bitmap.width, drawable.bitmap.height)
            drawable.draw(canvas)
            
            val converter = coordinateConverter
            if (converter != null) {
                // Draw APs if in debug mode
                if (isDebugMode) {
                    for (ap in apLocations) {
                        val (pxX, pxY) = converter.toPixels(ap.x, ap.y)
                        canvas.drawCircle(pxX, pxY, 15f, apPaint)
                        canvas.drawText(ap.bssid.takeLast(5), pxX, pxY - 20f, apLabelPaint)
                        
                        // Draw distance circle based on RSSI if available
                        latestReadings[ap.bssid]?.let { reading ->
                            val distanceM = estimateDistance(reading.rssi)
                            val (pxXEdge, _) = converter.toPixels(ap.x + distanceM, ap.y)
                            val radiusPx = Math.abs(pxXEdge - pxX)
                            canvas.drawCircle(pxX, pxY, radiusPx, circlePaint)
                        }
                    }
                }

                // Draw user position
                userPosition?.let { pos ->
                    val (pxX, pxY) = converter.toPixels(pos.x, pos.y)
                    canvas.drawCircle(pxX, pxY, 20f, userPaint)
                }
            }
            
            canvas.restore()
        } else {
            drawErrorMessage(canvas, "Failed to load map drawable")
        }
    }

    private fun drawErrorMessage(canvas: Canvas, message: String) {
        canvas.drawText(message, width / 2f, height / 2f, errorPaint)
    }

    /**
     * Simple Log-Distance Path Loss model for distance estimation.
     * dist = 10 ^ ((MeasuredPower - RSSI) / (10 * N))
     */
    private fun estimateDistance(rssi: Int): Double {
        val measuredPower = -40.0 // RSSI at 1 meter
        val n = 2.0 // Path loss exponent
        return 10.0.pow((measuredPower - rssi.toDouble()) / (10.0 * n))
    }
}
