package com.puihockyang.indoor_navigation

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.view.Surface
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.PI

internal class AndroidMotionException(
    val code: String,
    override val message: String,
) : RuntimeException(message)

internal class AndroidMotionAdapter(
    context: Context,
    private val displayRotationProvider: () -> Int,
) : SensorEventListener {
    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val linearAccelerationSensor =
        sensorManager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION)
    private val accelerometerSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private val rotationVectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
    private val gravityFilter = GravityFilter()
    private val disposed = AtomicBoolean(false)

    private var activeGeneration: Int? = null
    private var eventSink: ((Map<String, Any?>) -> Unit)? = null
    private var headingIntervalNanos = 0L
    private var lastHeadingTimestampNanos: Long? = null
    private var lastMotionTimestampNanos: Long? = null
    private var motionIntervalNanos = 0L
    private var running = false

    fun setEventSink(sink: ((Map<String, Any?>) -> Unit)?) {
        eventSink = sink
    }

    fun checkAvailability(): Map<String, Any> {
        ensureNotDisposed()
        return mapOf(
            "schemaVersion" to MOTION_SCHEMA_VERSION,
            "motionAvailable" to (linearAccelerationSensor != null || accelerometerSensor != null),
            "headingAvailable" to (rotationVectorSensor != null),
        )
    }

    fun requestPermissions(): Map<String, Any> {
        ensureNotDisposed()
        return mapOf(
            "schemaVersion" to MOTION_SCHEMA_VERSION,
            "status" to "granted",
        )
    }

    @Synchronized
    fun start(
        generation: Int,
        motionUpdateIntervalMs: Int,
        headingUpdateIntervalMs: Int,
    ) {
        ensureNotDisposed()
        stopSensors()
        val motionSensor = linearAccelerationSensor ?: accelerometerSensor
            ?: throw AndroidMotionException("unavailable", "Motion sensor is unavailable.")

        activeGeneration = generation
        motionIntervalNanos = motionUpdateIntervalMs * NANOS_PER_MILLISECOND
        headingIntervalNanos = headingUpdateIntervalMs * NANOS_PER_MILLISECOND
        lastMotionTimestampNanos = null
        lastHeadingTimestampNanos = null
        gravityFilter.reset()

        val motionRegistered = sensorManager.registerListener(
            this,
            motionSensor,
            motionUpdateIntervalMs * MICROSECONDS_PER_MILLISECOND,
        )
        if (!motionRegistered) {
            activeGeneration = null
            throw AndroidMotionException("startFailed", "Could not start Android motion sensor.")
        }
        rotationVectorSensor?.let { headingSensor ->
            sensorManager.registerListener(
                this,
                headingSensor,
                headingUpdateIntervalMs * MICROSECONDS_PER_MILLISECOND,
            )
        }
        running = true
    }

    @Synchronized
    fun stop(generation: Int) {
        ensureNotDisposed()
        if (activeGeneration != null && activeGeneration != generation) {
            return
        }
        stopSensors()
    }

    @Synchronized
    fun dispose() {
        if (!disposed.compareAndSet(false, true)) {
            return
        }
        stopSensors()
        eventSink = null
    }

    override fun onSensorChanged(event: SensorEvent) {
        val generation = synchronized(this) {
            if (!running || disposed.get()) null else activeGeneration
        } ?: return

        when (event.sensor.type) {
            Sensor.TYPE_LINEAR_ACCELERATION,
            Sensor.TYPE_ACCELEROMETER -> emitMotion(event, generation)
            Sensor.TYPE_ROTATION_VECTOR -> emitHeading(event, generation)
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    private fun emitMotion(event: SensorEvent, generation: Int) {
        if (!isDue(event.timestamp, lastMotionTimestampNanos, motionIntervalNanos)) {
            return
        }
        lastMotionTimestampNanos = event.timestamp
        val acceleration = if (event.sensor.type == Sensor.TYPE_LINEAR_ACCELERATION) {
            event.values.copyOf(3)
        } else {
            gravityFilter.removeGravity(event.values)
        }
        dispatch(
            generation,
            mapOf(
                "schemaVersion" to MOTION_SCHEMA_VERSION,
                "generation" to generation,
                "kind" to "motion",
                "accelerationX" to acceleration[0].toDouble(),
                "accelerationY" to acceleration[1].toDouble(),
                "accelerationZ" to acceleration[2].toDouble(),
                "fallbackHeadingDegrees" to null,
            ),
        )
    }

    private fun emitHeading(event: SensorEvent, generation: Int) {
        if (!isDue(event.timestamp, lastHeadingTimestampNanos, headingIntervalNanos)) {
            return
        }
        lastHeadingTimestampNanos = event.timestamp
        val rotationMatrix = FloatArray(9)
        SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
        val adjustedMatrix = adjustedRotationMatrix(
            rotationMatrix,
            displayRotationProvider(),
        )
        val orientation = FloatArray(3)
        SensorManager.getOrientation(adjustedMatrix, orientation)
        dispatch(
            generation,
            mapOf(
                "schemaVersion" to MOTION_SCHEMA_VERSION,
                "generation" to generation,
                "kind" to "heading",
                "headingDegrees" to normalizeHeadingRadians(orientation[0]),
                "source" to "magnetometer",
            ),
        )
    }

    private fun adjustedRotationMatrix(matrix: FloatArray, displayRotation: Int): FloatArray {
        val adjusted = FloatArray(9)
        val remapped = when (displayRotation) {
            Surface.ROTATION_90 -> SensorManager.remapCoordinateSystem(
                matrix,
                SensorManager.AXIS_Y,
                SensorManager.AXIS_MINUS_X,
                adjusted,
            )
            Surface.ROTATION_180 -> SensorManager.remapCoordinateSystem(
                matrix,
                SensorManager.AXIS_MINUS_X,
                SensorManager.AXIS_MINUS_Y,
                adjusted,
            )
            Surface.ROTATION_270 -> SensorManager.remapCoordinateSystem(
                matrix,
                SensorManager.AXIS_MINUS_Y,
                SensorManager.AXIS_X,
                adjusted,
            )
            else -> false
        }
        return if (remapped) adjusted else matrix
    }

    @Synchronized
    private fun dispatch(generation: Int, payload: Map<String, Any?>) {
        if (!running || disposed.get() || activeGeneration != generation) {
            return
        }
        eventSink?.invoke(payload)
    }

    private fun stopSensors() {
        sensorManager.unregisterListener(this)
        running = false
        activeGeneration = null
        lastMotionTimestampNanos = null
        lastHeadingTimestampNanos = null
        gravityFilter.reset()
    }

    private fun ensureNotDisposed() {
        if (disposed.get()) {
            throw AndroidMotionException("disposed", "Android motion adapter is disposed.")
        }
    }
}

internal class GravityFilter(
    private val smoothing: Float = 0.8f,
) {
    private val gravity = FloatArray(3)
    private var initialized = false

    fun removeGravity(values: FloatArray): FloatArray {
        if (!initialized) {
            for (index in 0..2) gravity[index] = values[index]
            initialized = true
        } else {
            for (index in 0..2) {
                gravity[index] = smoothing * gravity[index] + (1f - smoothing) * values[index]
            }
        }
        return FloatArray(3) { index -> values[index] - gravity[index] }
    }

    fun reset() {
        gravity.fill(0f)
        initialized = false
    }
}

internal fun normalizeHeadingRadians(radians: Float): Double {
    val degrees = radians.toDouble() * 180.0 / PI
    return ((degrees % 360.0) + 360.0) % 360.0
}

private fun isDue(timestamp: Long, previous: Long?, interval: Long): Boolean =
    previous == null || timestamp - previous >= interval

private const val MICROSECONDS_PER_MILLISECOND = 1_000
private const val NANOS_PER_MILLISECOND = 1_000_000L
