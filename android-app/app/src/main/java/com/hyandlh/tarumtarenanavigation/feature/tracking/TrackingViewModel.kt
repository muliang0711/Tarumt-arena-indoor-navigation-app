package com.hyandlh.tarumtarenanavigation.feature.tracking

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hyandlh.tarumtarenanavigation.core.apdata.repository.AccessPointCatalogRepository
import com.hyandlh.tarumtarenanavigation.core.model.AccessPointLocation
import com.hyandlh.tarumtarenanavigation.core.model.PositionEstimate
import com.hyandlh.tarumtarenanavigation.core.model.TrackingState
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import com.hyandlh.tarumtarenanavigation.core.observability.InMemoryLogStore
import com.hyandlh.tarumtarenanavigation.core.observability.LogEntry
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class TrackingViewModel @Inject constructor(
    private val trackingController: TrackingController,
    private val repository: AccessPointCatalogRepository,
    private val logStore: InMemoryLogStore
) : ViewModel() {

    val trackingState: StateFlow<TrackingState> = trackingController.state
    val currentPosition: StateFlow<PositionEstimate?> = trackingController.currentPosition
    val isPaused: StateFlow<Boolean> = trackingController.isPaused
    val latestSnapshot: StateFlow<WifiScanSnapshot?> = trackingController.latestSnapshot
    val logs: StateFlow<List<LogEntry>> = logStore.logs

    val apLocations: StateFlow<List<AccessPointLocation>> = repository.getCatalogFlow()
        .map { it?.locations?.values?.toList() ?: emptyList() }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _isDebugMode = MutableStateFlow(false)
    val isDebugMode: StateFlow<Boolean> = _isDebugMode.asStateFlow()

    private val _isPausingOrResuming = MutableStateFlow(false)
    val isPausingOrResuming: StateFlow<Boolean> = _isPausingOrResuming.asStateFlow()

    fun toggleTracking() {
        if (trackingState.value is TrackingState.Idle || trackingState.value is TrackingState.Error) {
            trackingController.startTracking()
        } else {
            trackingController.stopTracking()
        }
    }

    fun togglePauseResume() {
        viewModelScope.launch {
            _isPausingOrResuming.value = true
            if (isPaused.value) {
                trackingController.resumeScanning()
            } else {
                trackingController.pauseScanning()
            }
            _isPausingOrResuming.value = false
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
