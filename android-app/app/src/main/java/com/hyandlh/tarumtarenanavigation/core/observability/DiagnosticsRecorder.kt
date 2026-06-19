package com.hyandlh.tarumtarenanavigation.core.observability

import com.hyandlh.tarumtarenanavigation.core.common.AppLogger
import java.util.Locale
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Capture lifecycle events and diagnostics data with Session ID tracking.
 */
@Singleton
class DiagnosticsRecorder @Inject constructor(
    private val logger: AppLogger,
    private val logStore: InMemoryLogStore
) {
    private val TAG = "Diagnostics"
    private var currentSessionId: String = UUID.randomUUID().toString()

    fun startNewSession() {
        currentSessionId = UUID.randomUUID().toString()
        recordEvent("SessionStarted")
    }

    fun recordEvent(event: String, metadata: Map<String, String> = emptyMap()) {
        val metaString = metadata.entries.joinToString(", ") { "${it.key}=${it.value}" }
        val message = "[Session: $currentSessionId] Event: $event | Metadata: {$metaString}"
        logger.i(TAG, message)
        logStore.addLog(event, LogEntry.LogLevel.INFO)
    }

    fun recordError(error: String, throwable: Throwable? = null, metadata: Map<String, String> = emptyMap()) {
        val metaString = metadata.entries.joinToString(", ") { "${it.key}=${it.value}" }
        val message = "[Session: $currentSessionId] Error: $error | Metadata: {$metaString}"
        logger.e(TAG, message, throwable)
        logStore.addLog("ERROR: $error", LogEntry.LogLevel.ERROR)
    }

    fun recordCatalogUpdate(status: String) {
        val msg = "Updating the AP catalog: $status"
        logger.i(TAG, msg)
        logStore.addLog(msg)
    }

    fun recordScanRequest(timestamp: Long) {
        val msg = "Initiating wifi scan"
        logger.i(TAG, msg)
        logStore.addLog(msg)
    }

    fun recordScanResult(timestamp: Long, count: Int) {
        val msg = "Wifi scan complete. Results obtained from OS: $count APs"
        logger.i(TAG, msg)
        logStore.addLog(msg)
    }

    fun recordPositionCalculated(x: Double, y: Double, confidence: Double) {
        val msg = "Calculating your current location: (${String.format(Locale.US, "%.2f", x)}, ${String.format(Locale.US, "%.2f", y)})"
        logger.i(TAG, msg)
        logStore.addLog(msg)
    }
    
    fun recordMessage(message: String) {
        logStore.addLog(message)
    }
}
