package com.hyandlh.tarumtarenanavigation

import android.app.Application
import com.hyandlh.tarumtarenanavigation.core.observability.HealthHeartbeat
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class ArenaNavigationApplication : Application() {

    @Inject
    lateinit var healthHeartbeat: HealthHeartbeat

    override fun onCreate() {
        super.onCreate()
        
        // Start monitoring health of background components
        // Heartbeats are recorded in AndroidWifiScanner and DefaultPositioningEngine
        healthHeartbeat.startMonitoring(intervalMs = 30000, thresholdMs = 60000)
    }

    override fun onTerminate() {
        super.onTerminate()
        healthHeartbeat.stopMonitoring()
    }
}
