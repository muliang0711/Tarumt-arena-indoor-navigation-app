package com.hyandlh.tarumtarenanavigation.feature.tracking

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hyandlh.tarumtarenanavigation.R
import com.hyandlh.tarumtarenanavigation.core.apdata.repository.PositioningDataRepository
import com.hyandlh.tarumtarenanavigation.core.model.*
import com.hyandlh.tarumtarenanavigation.core.observability.InMemoryLogStore
import com.hyandlh.tarumtarenanavigation.core.observability.LogEntry
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class TransitionState { NONE, PAUSING, RESUMING }

data class PauseResumeButtonState(
    val textRes: Int,
    val isEnabled: Boolean,
    val isVisible: Boolean
)

@HiltViewModel
class TrackingViewModel @Inject constructor(
    private val trackingController: TrackingController,
    private val repository: PositioningDataRepository,
    private val logStore: InMemoryLogStore
) : ViewModel() {

    val trackingState: StateFlow<TrackingState> = trackingController.state
    val currentPosition: StateFlow<PositionEstimate?> = trackingController.currentPosition
    val isPaused: StateFlow<Boolean> = trackingController.isPaused
    val latestSnapshot: StateFlow<WifiScanSnapshot?> = trackingController.latestSnapshot
    val nodeDistances: StateFlow<Map<String, Double>>? = trackingController.nodeDistances
    val logs: StateFlow<List<LogEntry>> = logStore.logs

    val apLocations: StateFlow<List<AccessPointLocation>> = repository.getCatalogFlow()
        .map { it?.locations?.values?.toList() ?: emptyList() }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val nodes: StateFlow<List<Node>> = repository.getCatalogFlow()
        .map { it?.nodes?.values?.toList() ?: emptyList() }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val fingerprints: StateFlow<List<FingerprintEntry>> = repository.getCatalogFlow()
        .map { it?.fingerprints ?: emptyList() }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())


    private val _isDebugMode = MutableStateFlow(false)
    val isDebugMode: StateFlow<Boolean> = _isDebugMode.asStateFlow()

    private val _transitionState = MutableStateFlow(TransitionState.NONE)
    val transitionState: StateFlow<TransitionState> = _transitionState.asStateFlow()

    val pauseResumeButtonState: StateFlow<PauseResumeButtonState> = combine(
        trackingState,
        isPaused,
        transitionState
    ) { state, paused, transition ->
        val isTracking = state !is TrackingState.Idle && state !is TrackingState.LoadingCatalog && state !is TrackingState.Error
        
        val textRes = when (transition) {
            TransitionState.PAUSING -> R.string.pausing_scanning
            TransitionState.RESUMING -> R.string.resuming_scanning
            TransitionState.NONE -> if (paused) R.string.resume_scanning else R.string.pause_scanning
        }

        PauseResumeButtonState(
            textRes = textRes,
            isEnabled = transition == TransitionState.NONE,
            isVisible = isTracking
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), PauseResumeButtonState(R.string.pause_scanning, true, false))

    fun toggleTracking() {
        if (trackingState.value is TrackingState.Idle || trackingState.value is TrackingState.Error) {
            trackingController.startTracking()
        } else {
            trackingController.stopTracking()
        }
    }

    fun togglePauseResume() {
        viewModelScope.launch {
            if (isPaused.value) {
                _transitionState.value = TransitionState.RESUMING
                trackingController.resumeScanning()
                _transitionState.value = TransitionState.NONE
            } else {
                _transitionState.value = TransitionState.PAUSING
                trackingController.pauseScanning()
                _transitionState.value = TransitionState.NONE
            }
        }
    }

    fun toggleDebugMode() {
        _isDebugMode.value = !_isDebugMode.value
    }

    override fun onCleared() {
        super.onCleared()
        trackingController.stopTracking()
    }
}
