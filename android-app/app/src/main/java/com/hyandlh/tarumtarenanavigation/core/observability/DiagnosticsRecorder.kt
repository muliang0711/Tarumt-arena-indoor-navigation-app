package com.hyandlh.tarumtarenanavigation.core.observability

import com.hyandlh.tarumtarenanavigation.core.common.AppLogger
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Capture lifecycle events and diagnostics data with Session ID tracking.
 */
@Singleton
class DiagnosticsRecorder @Inject constructor(
    private val logger: AppLogger
) {
    private val TAG = "Diagnostics"
    private var currentSessionId: String = UUID.randomUUID().toString()

    fun startNewSession() {
        currentSessionId = UUID.randomUUID().toString()
        recordEvent("SessionStarted")
    }

    fun recordEvent(event: String, metadata: Map<String, String> = emptyMap()) {
        val metaString = metadata.entries.joinToString(", ") { "${it.key}=${it.value}" }
        logger.i(TAG, "[Session: $currentSessionId] Event: $event | Metadata: {$metaString}")
    }

    fun recordError(error: String, throwable: Throwable? = null, metadata: Map<String, String> = emptyMap()) {
        val metaString = metadata.entries.joinToString(", ") { "${it.key}=${it.value}" }
        logger.e(TAG, "[Session: $currentSessionId] Error: $error | Metadata: {$metaString}", throwable)
    }

    fun recordScanRequest(timestamp: Long) {
        recordEvent("ScanRequested", mapOf("timestamp" to timestamp.toString()))
    }

    fun recordScanResult(timestamp: Long, count: Int) {
        recordEvent("ScanResultReceived", mapOf(
            "timestamp" to timestamp.toString(),
            "count" to count.toString()
        ))
    }

    fun recordPositionCalculated(x: Double, y: Double, confidence: Double) {
        recordEvent("PositionCalculated", mapOf(
            "x" to String.format("%.2f", x),
            "y" to String.format("%.2f", y),
            "confidence" to String.format("%.2f", confidence)
        ))
    }
}
