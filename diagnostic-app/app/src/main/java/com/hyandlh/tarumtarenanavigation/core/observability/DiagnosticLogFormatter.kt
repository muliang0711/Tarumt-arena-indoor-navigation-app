package com.hyandlh.tarumtarenanavigation.core.observability

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object DiagnosticLogFormatter {
    private val timestampFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.getDefault())

    fun format(source: String, message: String, timestamp: Long = System.currentTimeMillis()): String {
        return "[${timestampFormat.format(Date(timestamp))}] [$source] $message"
    }

    fun inferCallerSource(): String {
        val ignoredClassNames = setOf(
            DiagnosticsRecorder::class.java.name,
            DiagnosticLogFormatter::class.java.name
        )

        val caller = Throwable().stackTrace.firstOrNull { frame ->
            frame.className !in ignoredClassNames &&
                !frame.className.startsWith("java.lang.") &&
                !frame.className.startsWith("dalvik.system.")
        }

        return caller?.let { frame ->
            val simpleClassName = frame.className.substringAfterLast('.').substringBefore('$')
            val methodName = if (frame.methodName == "invokeSuspend") "coroutine" else frame.methodName
            "$simpleClassName.$methodName"
        } ?: "Unknown.unknown"
    }
}
