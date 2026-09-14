package com.hyandlh.tarumtarenanavigation.di

import com.hyandlh.tarumtarenanavigation.core.common.AppLogger
import com.hyandlh.tarumtarenanavigation.core.observability.AndroidAppLogger
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class ObservabilityModule {

    @Binds
    @Singleton
    abstract fun bindAppLogger(
        androidAppLogger: AndroidAppLogger
    ): AppLogger
}
