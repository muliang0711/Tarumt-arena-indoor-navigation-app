// ═══════════════════════════════════════════════════════════════
//  Sensor Service — Wrapper around expo-sensors
//  Provides: step events, heading updates, turn detection
// ═══════════════════════════════════════════════════════════════

import {
    Accelerometer,
    Gyroscope,
    type AccelerometerMeasurement,
    type GyroscopeMeasurement,
} from 'expo-sensors';
import { NAV_CONFIG } from '../config/navigationConfig';

export type StepCallback = (stepLength: number) => void;
export type HeadingCallback = (heading: number) => void;
export type TurnCallback = (deltaYaw: number) => void;
export type RawSensorCallback = (data: {
    accel: AccelerometerMeasurement | null;
    gyro: GyroscopeMeasurement | null;
    heading: number;
}) => void;

/**
 * SensorService — manages IMU subscriptions and detects steps/turns.
 * 
 * Heading is accumulated from gyroscope z-axis (yaw).
 * Turn detection uses a sliding window of yaw values.
 * Step detection uses the Pedometer-like approach from accelerometer peaks.
 */
export class SensorService {
    private accelSub: ReturnType<typeof Accelerometer.addListener> | null = null;
    private gyroSub: ReturnType<typeof Gyroscope.addListener> | null = null;

    // Heading state (accumulated yaw from gyroscope)
    private heading = 0; // radians
    private lastGyroTime = 0;

    // Turn detection: sliding window of (timestamp, yaw) pairs
    private yawHistory: Array<{ time: number; yaw: number }> = [];
    private lastTurnTime = 0;

    // Step detection from accelerometer
    private accelMagnitudeHistory: number[] = [];
    private lastStepTime = 0;
    private stepThreshold = 1.15; // g-units threshold for step peak
    private stepCooldownMs = 300; // minimum ms between steps
    private stepCount = 0;

    // Latest raw data
    private latestAccel: AccelerometerMeasurement | null = null;
    private latestGyro: GyroscopeMeasurement | null = null;

    // Callbacks
    private onStep: StepCallback | null = null;
    private onHeading: HeadingCallback | null = null;
    private onTurn: TurnCallback | null = null;
    private onRawSensor: RawSensorCallback | null = null;

    constructor() { }

    /**
     * Set event callbacks
     */
    setCallbacks(cbs: {
        onStep?: StepCallback;
        onHeading?: HeadingCallback;
        onTurn?: TurnCallback;
        onRawSensor?: RawSensorCallback;
    }) {
        if (cbs.onStep) this.onStep = cbs.onStep;
        if (cbs.onHeading) this.onHeading = cbs.onHeading;
        if (cbs.onTurn) this.onTurn = cbs.onTurn;
        if (cbs.onRawSensor) this.onRawSensor = cbs.onRawSensor;
    }

    /**
     * Set the initial heading (from user selection or compass)
     */
    setInitialHeading(headingRad: number) {
        this.heading = headingRad;
        this.yawHistory = [];
    }

    /**
     * Get current heading in radians
     */
    getHeading(): number {
        return this.heading;
    }

    /**
     * Get total step count
     */
    getStepCount(): number {
        return this.stepCount;
    }

    /**
     * Start listening to sensors
     */
    async start() {
        // Set update intervals
        Accelerometer.setUpdateInterval(NAV_CONFIG.ACCEL_UPDATE_INTERVAL);
        Gyroscope.setUpdateInterval(NAV_CONFIG.GYRO_UPDATE_INTERVAL);

        this.lastGyroTime = Date.now();
        this.lastStepTime = Date.now();
        this.stepCount = 0;

        // Accelerometer — for step detection
        this.accelSub = Accelerometer.addListener((data: AccelerometerMeasurement) => {
            this.latestAccel = data;
            this.processAccelerometer(data);
            this.emitRawSensor();
        });

        // Gyroscope — for heading and turn detection
        this.gyroSub = Gyroscope.addListener((data: GyroscopeMeasurement) => {
            this.latestGyro = data;
            this.processGyroscope(data);
            this.emitRawSensor();
        });
    }

    /**
     * Stop all sensor subscriptions
     */
    stop() {
        this.accelSub?.remove();
        this.gyroSub?.remove();
        this.accelSub = null;
        this.gyroSub = null;
    }

    // ── Accelerometer Processing (Step Detection) ──────────────

    private processAccelerometer(data: AccelerometerMeasurement) {
        // Calculate magnitude of acceleration (in g-units, ~1.0 when stationary)
        const mag = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);
        this.accelMagnitudeHistory.push(mag);

        // Keep last 20 samples (~1 second at 20Hz)
        if (this.accelMagnitudeHistory.length > 20) {
            this.accelMagnitudeHistory.shift();
        }

        // Simple peak detection: if magnitude crosses threshold
        // and we haven't detected a step recently
        const now = Date.now();
        if (
            mag > this.stepThreshold &&
            now - this.lastStepTime > this.stepCooldownMs &&
            this.accelMagnitudeHistory.length > 3
        ) {
            // Check it's a peak (previous value was lower)
            const prev = this.accelMagnitudeHistory[this.accelMagnitudeHistory.length - 2];
            if (prev !== undefined && prev < mag) {
                this.lastStepTime = now;
                this.stepCount++;
                this.onStep?.(NAV_CONFIG.STEP_LENGTH_DEFAULT);
            }
        }
    }

    // ── Gyroscope Processing (Heading + Turn Detection) ────────

    private processGyroscope(data: GyroscopeMeasurement) {
        const now = Date.now();
        const dt = (now - this.lastGyroTime) / 1000; // seconds
        this.lastGyroTime = now;

        // Integrate gyroscope z-axis (yaw) to get heading
        // Note: gyro z is rotation rate around z-axis (rad/s)
        // On a phone held upright, z is yaw
        if (dt > 0 && dt < 0.5) {
            // Guard against huge dt (e.g., app resume)
            this.heading += data.z * dt;
            // Normalize to [-π, π]
            this.heading = wrapAngle(this.heading);
        }

        this.onHeading?.(this.heading);

        // Turn detection: check yaw change over sliding window
        this.yawHistory.push({ time: now, yaw: this.heading });

        // Remove old entries outside the window
        const windowStart = now - NAV_CONFIG.TURN_WINDOW_MS;
        while (this.yawHistory.length > 0 && this.yawHistory[0].time < windowStart) {
            this.yawHistory.shift();
        }

        // Check for turn: compare oldest and newest yaw in window
        if (this.yawHistory.length >= 2) {
            const oldest = this.yawHistory[0];
            const newest = this.yawHistory[this.yawHistory.length - 1];
            const deltaYaw = wrapAngle(newest.yaw - oldest.yaw);
            const deltaYawDeg = Math.abs(deltaYaw) * (180 / Math.PI);

            // Fire turn event if threshold exceeded and cooldown passed
            if (
                deltaYawDeg > NAV_CONFIG.TURN_ANGLE_THRESHOLD &&
                now - this.lastTurnTime > NAV_CONFIG.TURN_WINDOW_MS
            ) {
                this.lastTurnTime = now;
                this.onTurn?.(deltaYaw);
                // Clear history to avoid re-triggering
                this.yawHistory = [{ time: now, yaw: this.heading }];
            }
        }
    }

    // ── Raw Sensor Emission ────────────────────────────────────

    private emitRawSensor() {
        this.onRawSensor?.({
            accel: this.latestAccel,
            gyro: this.latestGyro,
            heading: this.heading,
        });
    }
}

// ── Math Helpers ──────────────────────────────────────────────

/**
 * Wrap angle to [-π, π]
 */
export function wrapAngle(a: number): number {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
}
