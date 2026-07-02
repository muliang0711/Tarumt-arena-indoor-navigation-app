package com.hyandlh.tarumtarenanavigation.di

import android.content.Context
import androidx.room.Room
import com.google.gson.Gson
import com.hyandlh.tarumtarenanavigation.core.apdata.local.ApDao
import com.hyandlh.tarumtarenanavigation.core.apdata.local.ApDatabase
import com.hyandlh.tarumtarenanavigation.core.apdata.remote.ApApiService
import com.hyandlh.tarumtarenanavigation.core.apdata.remote.MockApApiService
import com.hyandlh.tarumtarenanavigation.core.apdata.repository.AccessPointCatalogRepository
import com.hyandlh.tarumtarenanavigation.core.apdata.repository.PositioningDataRepository
import com.hyandlh.tarumtarenanavigation.core.positioning.FingerprintRepository
import com.hyandlh.tarumtarenanavigation.core.positioning.remote.PositioningApiService
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class DataModule {

    @Binds
    @Singleton
    abstract fun bindPositioningDataRepository(
        fingerprintRepository: FingerprintRepository
    ): PositioningDataRepository

    companion object {
        @Provides
        @Singleton
        fun provideGson(): Gson = Gson()

        @Provides
        @Singleton
        fun provideDatabase(@ApplicationContext context: Context): ApDatabase {
            return Room.databaseBuilder(
                context,
                ApDatabase::class.java,
                "arena_navigation_db"
            ).build()
        }

        @Provides
        fun provideApDao(database: ApDatabase): ApDao = database.apDao()

        @Provides
        @Singleton
        fun provideRetrofit(): Retrofit {
            return Retrofit.Builder()
                .baseUrl("http://localhost:8080/") // Default base URL
                .addConverterFactory(GsonConverterFactory.create())
                .build()
        }

        @Provides
        @Singleton
        fun provideApApiService(mockApApiService: MockApApiService): ApApiService {
            return mockApApiService
        }

        @Provides
        @Singleton
        fun providePositioningApiService(retrofit: Retrofit): PositioningApiService {
            return retrofit.create(PositioningApiService::class.java)
        }
    }
}
