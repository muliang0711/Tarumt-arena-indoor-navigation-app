package com.hyandlh.tarumtarenanavigation.di

import com.hyandlh.tarumtarenanavigation.core.wifi.AndroidWifiScanner
import com.hyandlh.tarumtarenanavigation.core.wifi.WifiScanSource
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class WifiModule {

    @Binds
    @Singleton
    abstract fun bindWifiScanSource(
        androidWifiScanner: AndroidWifiScanner
    ): WifiScanSource
}
