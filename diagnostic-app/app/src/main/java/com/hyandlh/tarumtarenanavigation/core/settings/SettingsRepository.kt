package com.hyandlh.tarumtarenanavigation.core.settings

import android.content.Context
import com.hyandlh.tarumtarenanavigation.config.GlobalConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SettingsRepository @Inject constructor(
    @ApplicationContext context: Context
) {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    private val _filterSsid = MutableStateFlow(
        preferences.getString(KEY_FILTER_SSID, GlobalConfig.DEFAULT_FILTER_SSID)
            ?: GlobalConfig.DEFAULT_FILTER_SSID
    )
    val filterSsid: StateFlow<String> = _filterSsid.asStateFlow()

    private val _closeNodeThresholdMeters = MutableStateFlow(
        Double.fromBits(
            preferences.getLong(
                KEY_CLOSE_NODE_THRESHOLD_METERS,
                DEFAULT_CLOSE_NODE_THRESHOLD_METERS.toBits()
            )
        )
    )
    val closeNodeThresholdMeters: StateFlow<Double> = _closeNodeThresholdMeters.asStateFlow()

    fun setFilterSsid(value: String) {
        val normalizedValue = value.trim()
        preferences.edit()
            .putString(KEY_FILTER_SSID, normalizedValue)
            .apply()
        _filterSsid.value = normalizedValue
    }

    fun setCloseNodeThresholdMeters(value: Double) {
        val normalizedValue = value.coerceIn(MIN_CLOSE_NODE_THRESHOLD_METERS, MAX_CLOSE_NODE_THRESHOLD_METERS)
        preferences.edit()
            .putLong(KEY_CLOSE_NODE_THRESHOLD_METERS, normalizedValue.toBits())
            .apply()
        _closeNodeThresholdMeters.value = normalizedValue
    }

    private companion object {
        const val PREFERENCES_NAME = "arena_navigation_settings"
        const val KEY_FILTER_SSID = "filter_ssid"
        const val KEY_CLOSE_NODE_THRESHOLD_METERS = "close_node_threshold_meters"
        const val DEFAULT_CLOSE_NODE_THRESHOLD_METERS = 8.0
        const val MIN_CLOSE_NODE_THRESHOLD_METERS = 1.0
        const val MAX_CLOSE_NODE_THRESHOLD_METERS = 100.0
    }
}
