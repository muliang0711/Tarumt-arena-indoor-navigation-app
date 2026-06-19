package com.hyandlh.tarumtarenanavigation.core.common

import javax.inject.Inject
import javax.inject.Singleton

/**
 * Converts between image pixel coordinates and navigation coordinate system (meters/units).
 * Based on the calibration data in main-activity.md
 */
@Singleton
class CoordinateConverter @Inject constructor() {

    // Origin in pixels (maps to 0,0 in navigation coordinates)
    private val originPxX = 940.1506036675864
    private val originPxY = 3219.948911199548

    // Calibration points for scaling
    // X scale: p2.px = 3834.41, val = 170.97
    private val p2X_px = 3834.4108206636756
    private val p2X_val = 170.971185
    private val scaleX = p2X_val / (p2X_px - originPxX)

    // Y scale: p2.py = 2362.78, val = 50.63
    // Note: Pixels increase downwards, but navigation Y increases upwards.
    private val p2Y_px = 2362.782970940217
    private val p2Y_val = 50.63209269
    private val scaleY = p2Y_val / (originPxY - p2Y_px)

    /**
     * Converts navigation coordinates (x, y) to image pixel coordinates.
     */
    fun toPixels(navX: Double, navY: Double): Pair<Float, Float> {
        val pxX = originPxX + (navX / scaleX)
        val pxY = originPxY - (navY / scaleY) // Subtract because pixel Y increases down
        return Pair(pxX.toFloat(), pxY.toFloat())
    }

    /**
     * Converts image pixel coordinates to navigation coordinates.
     */
    fun toNavCoords(pxX: Float, pxY: Float): Pair<Double, Double> {
        val navX = (pxX - originPxX) * scaleX
        val navY = (originPxY - pxY) * scaleY
        return Pair(navX, navY)
    }
}
