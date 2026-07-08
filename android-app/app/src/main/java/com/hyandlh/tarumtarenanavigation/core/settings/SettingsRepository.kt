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

    fun setFilterSsid(value: String) {
        val normalizedValue = value.trim()
        preferences.edit()
            .putString(KEY_FILTER_SSID, normalizedValue)
            .apply()
        _filterSsid.value = normalizedValue
    }

    private companion object {
        const val PREFERENCES_NAME = "arena_navigation_settings"
        const val KEY_FILTER_SSID = "filter_ssid"
    }
}
