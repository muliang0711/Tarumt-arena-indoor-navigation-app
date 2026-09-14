package com.hyandlh.tarumtarenanavigation.core.common

/**
 * A custom Result type for error handling.
 */
sealed class AppResult<out T> {
    data class Success<out T>(val data: T) : AppResult<T>()
    data class Failure(val error: AppError) : AppResult<Nothing>()
}

data class AppError(
    val message: String,
    val code: String? = null,
    val throwable: Throwable? = null
)

interface AppLogger {
    fun d(tag: String, message: String)
    fun i(tag: String, message: String)
    fun w(tag: String, message: String, throwable: Throwable? = null)
    fun e(tag: String, message: String, throwable: Throwable? = null)
}
