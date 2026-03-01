// ═══════════════════════════════════════════════════════════════
//  Navigation Config — All tunable parameters in one place
// ═══════════════════════════════════════════════════════════════

export const NAV_CONFIG = {
    // ── Scale ────────────────────────────────────────────────────
    /** How many real meters per grid unit in the JSON coordinates */
    METERS_PER_GRID_UNIT: 10,

    // ── Corridor Constraint ──────────────────────────────────────
    /** Total corridor width in meters (user clamped to ±half of this) */
    CORRIDOR_WIDTH: 3,

    // ── Node Proximity ───────────────────────────────────────────
    /** Distance (meters) from a node endpoint to be considered "near node" */
    NODE_PROXIMITY_THRESHOLD: 2.0,

    // ── Turn Detection ───────────────────────────────────────────
    /** Minimum yaw change (degrees) to consider a turn event */
    TURN_ANGLE_THRESHOLD: 30,
    /** Time window (ms) over which yaw change is measured */
    TURN_WINDOW_MS: 800,

    // ── Edge Switching ───────────────────────────────────────────
    /** Gaussian σ (degrees) for heading-to-edge direction scoring */
    HEADING_MATCH_SIGMA: 25,

    // ── PDR (Pedestrian Dead Reckoning) ──────────────────────────
    /** Default step length in meters */
    STEP_LENGTH_DEFAULT: 0.65,

    // ── Sensor ───────────────────────────────────────────────────
    /** Gyroscope update interval (ms) — 50Hz */
    GYRO_UPDATE_INTERVAL: 20,
    /** Accelerometer update interval (ms) — 20Hz */
    ACCEL_UPDATE_INTERVAL: 50,

    // ── Map Rendering ────────────────────────────────────────────
    /** Pixels per meter for SVG rendering */
    PIXELS_PER_METER: 5,
    /** Map padding in pixels */
    MAP_PADDING: 40,
} as const;

/** Derived constants */
export const CORRIDOR_HALF_WIDTH = NAV_CONFIG.CORRIDOR_WIDTH / 2;
export const TURN_THRESHOLD_RAD = (NAV_CONFIG.TURN_ANGLE_THRESHOLD * Math.PI) / 180;
export const SIGMA_RAD = (NAV_CONFIG.HEADING_MATCH_SIGMA * Math.PI) / 180;
