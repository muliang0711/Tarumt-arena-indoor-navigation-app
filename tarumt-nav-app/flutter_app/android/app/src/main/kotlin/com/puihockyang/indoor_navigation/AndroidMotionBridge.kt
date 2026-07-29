package com.puihockyang.indoor_navigation

import android.content.Context
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

internal const val MOTION_SCHEMA_VERSION = 1
private const val MOTION_METHOD_CHANNEL = "indoor_navigation/core_motion/methods/v1"
private const val MOTION_EVENT_CHANNEL = "indoor_navigation/core_motion/events/v1"

internal class AndroidMotionBridge(
    context: Context,
    messenger: BinaryMessenger,
    displayRotationProvider: () -> Int,
) : EventChannel.StreamHandler {
    private val adapter = AndroidMotionAdapter(
        context = context,
        displayRotationProvider = displayRotationProvider,
    )
    private val methodChannel = MethodChannel(messenger, MOTION_METHOD_CHANNEL)
    private val eventChannel = EventChannel(messenger, MOTION_EVENT_CHANNEL)

    init {
        methodChannel.setMethodCallHandler(::handleMethodCall)
        eventChannel.setStreamHandler(this)
    }

    override fun onListen(arguments: Any?, events: EventChannel.EventSink) {
        adapter.setEventSink { payload -> events.success(payload) }
    }

    override fun onCancel(arguments: Any?) {
        adapter.setEventSink(null)
    }

    fun close() {
        methodChannel.setMethodCallHandler(null)
        eventChannel.setStreamHandler(null)
        adapter.dispose()
    }

    private fun handleMethodCall(call: MethodCall, result: MethodChannel.Result) {
        try {
            when (call.method) {
                "checkAvailability" -> result.success(adapter.checkAvailability())
                "requestPermissions" -> result.success(adapter.requestPermissions())
                "start" -> {
                    adapter.start(
                        generation = call.requiredInt("generation"),
                        motionUpdateIntervalMs = call.requiredInt("motionUpdateIntervalMs"),
                        headingUpdateIntervalMs = call.requiredInt("headingUpdateIntervalMs"),
                    )
                    result.success(controlResponse())
                }
                "stop" -> {
                    adapter.stop(call.requiredInt("generation"))
                    result.success(controlResponse())
                }
                "dispose" -> {
                    adapter.dispose()
                    result.success(controlResponse())
                }
                else -> result.notImplemented()
            }
        } catch (error: AndroidMotionException) {
            result.error(error.code, error.message, null)
        } catch (error: RuntimeException) {
            result.error("streamFailed", error.message ?: "Android motion operation failed.", null)
        }
    }
}

private fun MethodCall.requiredInt(name: String): Int {
    val arguments = arguments as? Map<*, *>
        ?: throw AndroidMotionException("invalidArgument", "arguments must be a map")
    val schemaVersion = arguments["schemaVersion"] as? Number
        ?: throw AndroidMotionException("invalidArgument", "schemaVersion must be an integer")
    if (schemaVersion.toInt() != MOTION_SCHEMA_VERSION) {
        throw AndroidMotionException("invalidArgument", "unsupported schemaVersion")
    }
    val value = arguments[name] as? Number
        ?: throw AndroidMotionException("invalidArgument", "$name must be an integer")
    return value.toInt().also { parsed ->
        val invalid = if (name == "generation") parsed < 0 else parsed <= 0
        if (invalid) {
            throw AndroidMotionException("invalidArgument", "$name is out of range")
        }
    }
}

private fun controlResponse(): Map<String, Any> = mapOf(
    "schemaVersion" to MOTION_SCHEMA_VERSION,
)
