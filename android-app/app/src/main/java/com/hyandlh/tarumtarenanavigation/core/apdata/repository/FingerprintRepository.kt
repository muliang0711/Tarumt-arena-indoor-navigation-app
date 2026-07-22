package com.hyandlh.tarumtarenanavigation.core.apdata.repository

import com.hyandlh.tarumtarenanavigation.config.GlobalConfig
import com.hyandlh.tarumtarenanavigation.core.common.AppError
import com.hyandlh.tarumtarenanavigation.core.common.AppResult
import com.hyandlh.tarumtarenanavigation.core.model.AccessPointCatalog
import com.hyandlh.tarumtarenanavigation.core.observability.DiagnosticsRecorder
import com.hyandlh.tarumtarenanavigation.core.positioning.remote.PositioningApiService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FingerprintRepository @Inject constructor(
    private val apiService: PositioningApiService,
    private val appScope: CoroutineScope,
    private val diagnostics: DiagnosticsRecorder,
) : PositioningDataRepository {
    private val _catalog = MutableStateFlow<AccessPointCatalog?>(null)

    init {
        appScope.launch {
            loadDataRemote()
        }
    }

    override fun getCatalogFlow(): Flow<AccessPointCatalog?> {
        return _catalog.asStateFlow()
    }

    override suspend fun refreshCatalog(): AppResult<Unit> {
        return loadDataRemote()
    }

    private suspend fun loadDataRemote(): AppResult<Unit> {
        return try {
            val apiUrlNodes =
                "${GlobalConfig.KNN_API_BASE_URL}/${GlobalConfig.KNN_API_ENDPOINT_GETNODEREGISTRY}"

            diagnostics.recordEvent(
                "Loading node registry from KNN API",
                metadata = mapOf("url" to apiUrlNodes),
                source = "FingerprintRepository.loadDataRemote"
            )
            val nodeRegistry = apiService.getNodeRegistry(apiUrlNodes)

            _catalog.value = AccessPointCatalog(
                version = "node-registry-1.0",
                nodes = nodeRegistry,
                lastUpdated = System.currentTimeMillis()
            )

            diagnostics.recordEvent(
                "Node registry loaded",
                metadata = mapOf("nodes" to nodeRegistry.size.toString()),
                source = "FingerprintRepository.loadDataRemote"
            )
            AppResult.Success(Unit)
        } catch (e: HttpException) {
            remoteLoadFailure("HTTP error loading fingerprint catalog: ${e.code()} ${e.message()}", e)
        } catch (e: IOException) {
            remoteLoadFailure("Network error loading fingerprint catalog: ${e.message}", e)
        } catch (e: kotlinx.serialization.SerializationException) {
            remoteLoadFailure("Serialization error loading fingerprint catalog: ${e.message}", e)
        } catch (e: Exception) {
            remoteLoadFailure("Unexpected error loading fingerprint catalog: ${e.message}", e)
        }
    }

    private fun remoteLoadFailure(message: String, throwable: Throwable): AppResult.Failure {
        diagnostics.recordError(
            message,
            throwable,
            metadata = mapOf("baseUrl" to GlobalConfig.KNN_API_BASE_URL),
            source = "FingerprintRepository.loadDataRemote"
        )
        return AppResult.Failure(AppError(message, throwable = throwable))
    }
}
