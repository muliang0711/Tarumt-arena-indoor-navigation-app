package com.hyandlh.tarumtarenanavigation.di

import com.hyandlh.tarumtarenanavigation.core.positioning.KnnWifiPositioningEngine
import com.hyandlh.tarumtarenanavigation.core.positioning.MovingAverageSmoother
import com.hyandlh.tarumtarenanavigation.core.positioning.PositionSmoother
import com.hyandlh.tarumtarenanavigation.core.positioning.PositioningEngine
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class PositioningModule {

    @Binds
    @Singleton
    abstract fun bindPositioningEngine(
        engine: KnnWifiPositioningEngine
    ): PositioningEngine

    @Binds
    abstract fun bindPositionSmoother(
        smoother: MovingAverageSmoother
    ): PositionSmoother
}
