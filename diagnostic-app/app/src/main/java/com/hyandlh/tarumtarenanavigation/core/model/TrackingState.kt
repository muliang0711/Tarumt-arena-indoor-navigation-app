package com.hyandlh.tarumtarenanavigation.core.model

/**
 * Current state of the tracking session.
 */
sealed class TrackingState {
    object Idle : TrackingState()
    object LoadingCatalog : TrackingState()
    object Scanning : TrackingState()
    object Positioning : TrackingState()
    object StaleData : TrackingState()
    data class Error(val message: String, val code: String? = null) : TrackingState()
    object Paused : TrackingState()
}
