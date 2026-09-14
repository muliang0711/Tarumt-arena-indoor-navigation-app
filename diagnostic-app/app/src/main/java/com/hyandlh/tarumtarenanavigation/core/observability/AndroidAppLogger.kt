package com.hyandlh.tarumtarenanavigation.core.observability

import android.util.Log
import com.hyandlh.tarumtarenanavigation.core.common.AppLogger
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Android implementation of AppLogger using Logcat.
 */
@Singleton
class AndroidAppLogger @Inject constructor() : AppLogger {
    override fun d(tag: String, message: String) {
        Log.d(tag, message)
        println(message)
    }

    override fun i(tag: String, message: String) {
        Log.i(tag, message)
        println(message)
    }

    override fun w(tag: String, message: String, throwable: Throwable?) {
        Log.w(tag, message, throwable)
        println(message)
    }

    override fun e(tag: String, message: String, throwable: Throwable?) {
        Log.e(tag, message, throwable)
        System.err.println(message)
    }
}
