package com.hyandlh.tarumtarenanavigation.core.motion

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.Looper
import com.hyandlh.tarumtarenanavigation.core.observability.DiagnosticsRecorder
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.min
import kotlin.math.sqrt

data class MotionSnapshot(
    val headingDegrees: Float?,
    val walkingSpeedMetersPerSecond: Double,
    val source: String
)

@Singleton
class MotionSensorMonitor @Inject constructor(
    @ApplicationContext context: Context,
    private val diagnostics: DiagnosticsRecorder
) : SensorEventListener {

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val mainHandler = Handler(Looper.getMainLooper())
    private val rotationVectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
    private val stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    private val accelerometerSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

    @Volatile
    private var isMonitoring = false

    @Volatile
    private var latestHeadingDegrees: Float? = null

    @Volatile
    private var latestWalkingSpeedMetersPerSecond: Double = 0.0

    @Volatile
    private var lastSpeedUpdatedAtMillis: Long = 0L

    private var lastStepCount: Float? = null
    private var lastStepTimestampNs: Long? = null
    private val gravity = FloatArray(3)

    fun startMonitoring() {
        if (isMonitoring) return
        isMonitoring = true

        rotationVectorSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_UI, mainHandler)
        }
        stepCounterSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL, mainHandler)
        }
        accelerometerSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL, mainHandler)
        }

        diagnostics.recordEvent(
            "Phone motion monitoring started",
            metadata = mapOf(
                "rotationVector" to (rotationVectorSensor != null).toString(),
                "stepCounter" to (stepCounterSensor != null).toString(),
                "accelerometer" to (accelerometerSensor != null).toString()
            ),
            source = "MotionSensorMonitor.startMonitoring"
        )
    }

    fun stopMonitoring() {
        if (!isMonitoring) return
        sensorManager.unregisterListener(this)
        isMonitoring = false
        latestWalkingSpeedMetersPerSecond = 0.0
        lastSpeedUpdatedAtMillis = 0L
        lastStepCount = null
        lastStepTimestampNs = null
        diagnostics.recordEvent(
            "Phone motion monitoring stopped",
            source = "MotionSensorMonitor.stopMonitoring"
        )
    }

    fun snapshot(): MotionSnapshot {
        val source = when {
            stepCounterSensor != null -> "step_counter"
            accelerometerSensor != null -> "accelerometer"
            else -> "unavailable"
        }
        return MotionSnapshot(
            headingDegrees = latestHeadingDegrees,
            walkingSpeedMetersPerSecond = currentWalkingSpeed(),
            source = source
        )
    }

    override fun onSensorChanged(event: SensorEvent) {
        when (event.sensor.type) {
            Sensor.TYPE_ROTATION_VECTOR -> updateHeading(event.values)
            Sensor.TYPE_STEP_COUNTER -> updateStepCounterSpeed(event.values.firstOrNull(), event.timestamp)
            Sensor.TYPE_ACCELEROMETER -> if (stepCounterSensor == null) {
                updateAccelerometerSpeed(event.values)
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    private fun updateHeading(values: FloatArray) {
        val rotationMatrix = FloatArray(9)
        val orientation = FloatArray(3)
        SensorManager.getRotationMatrixFromVector(rotationMatrix, values)
        SensorManager.getOrientation(rotationMatrix, orientation)
        val azimuthRadians = orientation[0].toDouble()
        val azimuthDegrees = Math.toDegrees(azimuthRadians)
        latestHeadingDegrees = ((azimuthDegrees + 360.0) % 360.0).toFloat()
    }

    private fun updateStepCounterSpeed(stepCount: Float?, timestampNs: Long) {
        if (stepCount == null) return
        val previousCount = lastStepCount
        val previousTimestamp = lastStepTimestampNs
        lastStepCount = stepCount
        lastStepTimestampNs = timestampNs

        if (previousCount == null || previousTimestamp == null) return
        val elapsedSeconds = (timestampNs - previousTimestamp) / 1_000_000_000.0
        if (elapsedSeconds <= 0.0) return

        val stepDelta = (stepCount - previousCount).coerceAtLeast(0f).toDouble()
        val measuredSpeed = (stepDelta * AVERAGE_STRIDE_METERS / elapsedSeconds)
            .coerceIn(0.0, MAX_WALKING_SPEED_METERS_PER_SECOND)
        updateWalkingSpeed(measuredSpeed)
    }

    private fun updateAccelerometerSpeed(values: FloatArray) {
        for (index in values.indices.take(3)) {
            gravity[index] = LOW_PASS_ALPHA * gravity[index] + (1f - LOW_PASS_ALPHA) * values[index]
        }

        val linearX = values[0] - gravity[0]
        val linearY = values[1] - gravity[1]
        val linearZ = values[2] - gravity[2]
        val linearMagnitude = sqrt(
            linearX.toDouble() * linearX +
                linearY.toDouble() * linearY +
                linearZ.toDouble() * linearZ
        )

        val measuredSpeed = if (linearMagnitude < STILL_ACCELERATION_METERS_PER_SECOND_SQUARED) {
            0.0
        } else {
            min(
                MAX_ACCELEROMETER_DERIVED_SPEED_METERS_PER_SECOND,
                linearMagnitude * ACCELERATION_TO_SPEED_SCALE
            )
        }
        updateWalkingSpeed(measuredSpeed)
    }

    private fun updateWalkingSpeed(measuredSpeed: Double) {
        latestWalkingSpeedMetersPerSecond = SPEED_SMOOTHING_ALPHA * latestWalkingSpeedMetersPerSecond +
            (1.0 - SPEED_SMOOTHING_ALPHA) * measuredSpeed
        lastSpeedUpdatedAtMillis = System.currentTimeMillis()
    }

    private fun currentWalkingSpeed(): Double {
        val ageMs = System.currentTimeMillis() - lastSpeedUpdatedAtMillis
        return if (lastSpeedUpdatedAtMillis == 0L || ageMs > STALE_SPEED_AFTER_MS) {
            0.0
        } else {
            latestWalkingSpeedMetersPerSecond
        }
    }

    private companion object {
        const val AVERAGE_STRIDE_METERS = 0.75
        const val MAX_WALKING_SPEED_METERS_PER_SECOND = 2.2
        const val MAX_ACCELEROMETER_DERIVED_SPEED_METERS_PER_SECOND = 1.8
        const val LOW_PASS_ALPHA = 0.8f
        const val SPEED_SMOOTHING_ALPHA = 0.65
        const val STILL_ACCELERATION_METERS_PER_SECOND_SQUARED = 0.15
        const val ACCELERATION_TO_SPEED_SCALE = 0.45
        const val STALE_SPEED_AFTER_MS = 3000L
    }
}
