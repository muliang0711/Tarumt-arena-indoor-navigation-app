package com.hyandlh.tarumtarenanavigation.di

import android.content.Context
import androidx.room.Room
import com.google.gson.Gson
import com.hyandlh.tarumtarenanavigation.core.apdata.local.ApDao
import com.hyandlh.tarumtarenanavigation.core.apdata.local.ApDatabase
import com.hyandlh.tarumtarenanavigation.core.apdata.remote.ApApiService
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
object DataModule {

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
            .baseUrl("https://api.example.com/") // Placeholder
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideApApiService(retrofit: Retrofit): ApApiService {
        return retrofit.create(ApApiService::class.java)
    }
}
