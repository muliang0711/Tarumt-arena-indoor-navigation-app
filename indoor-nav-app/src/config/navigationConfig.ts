// ═══════════════════════════════════════════════════════════════
//  Navigation Config — All tunable parameters in one place
// ═══════════════════════════════════════════════════════════════

export const NAV_CONFIG = {
    // ── Scale ────────────────────────────────────────────────────
    METERS_PER_GRID_UNIT: 10,

    // ── Corridor Constraint ──────────────────────────────────────
    CORRIDOR_WIDTH: 3,

    // ── Node Proximity ───────────────────────────────────────────
    NODE_PROXIMITY_THRESHOLD: 2.0,

    // ── Turn Detection ───────────────────────────────────────────
    TURN_ANGLE_THRESHOLD: 15,
    TURN_WINDOW_MS: 800,

    // ── Edge Switching (legacy, used by PF scoring) ──────────────
    HEADING_MATCH_SIGMA: 25,

    // ── Path-Aware Scoring ──────────────────────────────────────
    PATH_BONUS_MULTIPLIER: 3.0,

    // ── Heading Correction ──────────────────────────────────────
    HEADING_CORRECTION_ALPHA: 0.10,

    // ══════════════════════════════════════════════════════════════
    //  PARTICLE FILTER (PF v1)
    // ══════════════════════════════════════════════════════════════

    /** Number of particles */
    PF_NUM_PARTICLES: 80,

    /** Step length noise σ (meters). Adds uncertainty to step distance. */
    PF_STEP_NOISE_SIGMA: 0.08,

    /** Heading noise σ (radians, ~5°). Adds uncertainty to heading per step. */
    PF_HEADING_NOISE_SIGMA: 0.09,

    /** Resample when N_eff < NUM_PARTICLES × this fraction */
    PF_RESAMPLE_THRESHOLD: 0.5,

    /** Fraction of particles injected as "explorers" at junctions on turn events.
     *  These get random adjacent edges to ensure diversity. */
    PF_EXPLORER_RATIO: 0.15,

    /** Minimum weight for a particle to survive. Below this → eliminated in resampling. */
    PF_MIN_WEIGHT: 0.001,

    // ── PDR ─────────────────────────────────────────────────────
    STEP_LENGTH_DEFAULT: 0.65,

    // ── Sensor ──────────────────────────────────────────────────
    GYRO_UPDATE_INTERVAL: 20,
    ACCEL_UPDATE_INTERVAL: 50,

    // ── Map Rendering ───────────────────────────────────────────
    PIXELS_PER_METER: 5,
    MAP_PADDING: 40,
} as const;

/** Derived constants */
export const CORRIDOR_HALF_WIDTH = NAV_CONFIG.CORRIDOR_WIDTH / 2;
export const TURN_THRESHOLD_RAD = (NAV_CONFIG.TURN_ANGLE_THRESHOLD * Math.PI) / 180;
export const SIGMA_RAD = (NAV_CONFIG.HEADING_MATCH_SIGMA * Math.PI) / 180;
