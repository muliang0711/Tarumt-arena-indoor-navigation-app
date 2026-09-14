package com.hyandlh.tarumtarenanavigation.core.observability

import com.hyandlh.tarumtarenanavigation.core.common.AppLogger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicLong
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Monitor the health of background tasks by recording heartbeats.
 */
@Singleton
class HealthHeartbeat @Inject constructor(
    private val logger: AppLogger,
    private val logStore: InMemoryLogStore
) {
    private val TAG = "HealthHeartbeat"
    private val lastHeartbeats = mutableMapOf<String, AtomicLong>()
    private var monitorJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.Default)

    /**
     * Records a heartbeat for a specific component.
     */
    fun beat(componentName: String) {
        val now = System.currentTimeMillis()
        lastHeartbeats.getOrPut(componentName) { AtomicLong(now) }.set(now)
        logger.d(TAG, DiagnosticLogFormatter.format("HealthHeartbeat.beat", "Heartbeat from $componentName at $now"))
    }

    /**
     * Starts a background monitor that logs warnings if heartbeats are missed.
     */
    fun startMonitoring(intervalMs: Long = 60000, thresholdMs: Long = 120000) {
        monitorJob?.cancel()
        monitorJob = scope.launch {
            while (isActive) {
                delay(intervalMs)
                checkHealth(thresholdMs)
            }
        }
    }

    fun stopMonitoring() {
        monitorJob?.cancel()
        monitorJob = null
    }

    private fun checkHealth(thresholdMs: Long) {
        val now = System.currentTimeMillis()
        lastHeartbeats.forEach { (name, lastTime) ->
            if (now - lastTime.get() > thresholdMs) {
                val message = DiagnosticLogFormatter.format(
                    "HealthHeartbeat.checkHealth",
                    "Component $name is UNHEALTHY. Last heartbeat: ${lastTime.get()}ms ago"
                )
                logger.w(TAG, message)
                logStore.addLog(message, LogEntry.LogLevel.WARNING)
            }
        }
    }
}
