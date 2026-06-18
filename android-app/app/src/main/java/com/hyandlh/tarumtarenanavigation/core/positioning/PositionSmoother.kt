package com.hyandlh.tarumtarenanavigation.core.positioning

import com.hyandlh.tarumtarenanavigation.core.model.PositionEstimate
import javax.inject.Inject

/**
 * Interface for smoothing position estimates over time.
 */
interface PositionSmoother {
    fun smooth(newEstimate: PositionEstimate): PositionEstimate
    fun reset()
}

/**
 * A simple Moving Average smoother for position estimates.
 */
class MovingAverageSmoother @Inject constructor() : PositionSmoother {
    private val windowSize = 3
    private val history = mutableListOf<PositionEstimate>()

    override fun smooth(newEstimate: PositionEstimate): PositionEstimate {
        history.add(newEstimate)
        if (history.size > windowSize) {
            history.removeAt(0)
        }

        if (history.isEmpty()) return newEstimate

        // Check if we switched floors. If so, reset history to avoid smoothing across floors.
        if (history.any { it.floorId != newEstimate.floorId }) {
            reset()
            history.add(newEstimate)
            return newEstimate
        }

        val avgX = history.map { it.x }.average()
        val avgY = history.map { it.y }.average()
        val avgConfidence = history.map { it.confidence }.average()

        return PositionEstimate(
            x = avgX,
            y = avgY,
            floorId = newEstimate.floorId,
            confidence = avgConfidence,
            timestamp = newEstimate.timestamp
        )
    }

    override fun reset() {
        history.clear()
    }
}
