package com.hyandlh.tarumtarenanavigation.core.observability

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.atomic.AtomicLong
import javax.inject.Inject
import javax.inject.Singleton

data class LogEntry(
    val id: Long,
    val timestamp: Long,
    val message: String,
    val level: LogLevel
) {
    enum class LogLevel { INFO, ERROR, WARNING, DEBUG }
    
    val formattedTime: String = SimpleDateFormat("HH:mm:ss.SSS", Locale.getDefault()).format(Date(timestamp))
}

@Singleton
class InMemoryLogStore @Inject constructor() {
    private val _logs = MutableStateFlow<List<LogEntry>>(emptyList())
    val logs: StateFlow<List<LogEntry>> = _logs.asStateFlow()

    private val maxLogs = 1000
    private val idGenerator = AtomicLong(0)

    fun addLog(message: String, level: LogEntry.LogLevel = LogEntry.LogLevel.INFO) {
        val newEntry = LogEntry(idGenerator.incrementAndGet(), System.currentTimeMillis(), message, level)
        val currentList = _logs.value.toMutableList()
        currentList.add(newEntry)
        if (currentList.size > maxLogs) {
            currentList.removeAt(0)
        }
        _logs.value = currentList
    }

    fun clear() {
        _logs.value = emptyList()
    }
}
