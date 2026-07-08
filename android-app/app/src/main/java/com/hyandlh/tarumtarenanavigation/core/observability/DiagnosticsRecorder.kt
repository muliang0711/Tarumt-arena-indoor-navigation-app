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

    fun recordEvent(
        event: String,
        metadata: Map<String, String> = emptyMap(),
        source: String = DiagnosticLogFormatter.inferCallerSource()
    ) {
        write(LogEntry.LogLevel.INFO, source, "Event: $event", metadata)
    }

    fun recordError(
        error: String,
        throwable: Throwable? = null,
        metadata: Map<String, String> = emptyMap(),
        source: String = DiagnosticLogFormatter.inferCallerSource()
    ) {
        write(LogEntry.LogLevel.ERROR, source, "Error: $error", metadata, throwable)
    }

    fun recordCatalogUpdate(
        status: String,
        source: String = DiagnosticLogFormatter.inferCallerSource()
    ) {
        write(LogEntry.LogLevel.INFO, source, "Updating positioning catalog: $status")
    }

    fun recordScanRequest(
        timestamp: Long,
        source: String = DiagnosticLogFormatter.inferCallerSource()
    ) {
        write(LogEntry.LogLevel.INFO, source, "Initiating Wi-Fi scan", mapOf("requestedAt" to timestamp.toString()))
    }

    fun recordScanResult(
        timestamp: Long,
        count: Int,
        source: String = DiagnosticLogFormatter.inferCallerSource()
    ) {
        write(
            LogEntry.LogLevel.INFO,
            source,
            "Wi-Fi scan complete",
            mapOf("scanTimestamp" to timestamp.toString(), "readings" to count.toString())
        )
    }

    fun recordPositionCalculated(
        x: Double,
        y: Double,
        confidence: Double,
        source: String = DiagnosticLogFormatter.inferCallerSource()
    ) {
        write(
            LogEntry.LogLevel.INFO,
            source,
            "Position calculated",
            mapOf(
                "x" to String.format(Locale.US, "%.2f", x),
                "y" to String.format(Locale.US, "%.2f", y),
                "confidence" to String.format(Locale.US, "%.4f", confidence)
            )
        )
    }

    fun recordRemotePositioning(
        success: Boolean,
        latencyMs: Long,
        error: String? = null,
        source: String = DiagnosticLogFormatter.inferCallerSource()
    ) {
        val status = if (success) "SUCCESS" else "FAILED"
        val metadata = buildMap {
            put("status", status)
            put("latencyMs", latencyMs.toString())
            if (error != null) put("error", error)
        }
        if (success) {
            write(LogEntry.LogLevel.INFO, source, "Remote positioning completed", metadata)
        } else {
            write(LogEntry.LogLevel.ERROR, source, "Remote positioning failed", metadata)
        }
    }
    
    fun recordMessage(
        message: String,
        source: String = DiagnosticLogFormatter.inferCallerSource()
    ) {
        write(LogEntry.LogLevel.INFO, source, message)
    }

    private fun write(
        level: LogEntry.LogLevel,
        source: String,
        message: String,
        metadata: Map<String, String> = emptyMap(),
        throwable: Throwable? = null
    ) {
        val metadataText = metadata
            .takeIf { it.isNotEmpty() }
            ?.entries
            ?.joinToString(prefix = " | ", separator = ", ") { "${it.key}=${it.value}" }
            .orEmpty()
        val sessionText = "session=$currentSessionId"
        val rendered = DiagnosticLogFormatter.format(source, "$message | $sessionText$metadataText")

        when (level) {
            LogEntry.LogLevel.ERROR -> logger.e(TAG, rendered, throwable)
            LogEntry.LogLevel.WARNING -> logger.w(TAG, rendered, throwable)
            LogEntry.LogLevel.DEBUG -> logger.d(TAG, rendered)
            LogEntry.LogLevel.INFO -> logger.i(TAG, rendered)
        }
        logStore.addLog(rendered, level)
    }
}
