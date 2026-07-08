package com.hyandlh.tarumtarenanavigation.core.apdata.repository

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.hyandlh.tarumtarenanavigation.config.GlobalConfig
import com.hyandlh.tarumtarenanavigation.core.common.AppError
import com.hyandlh.tarumtarenanavigation.core.common.AppResult
import com.hyandlh.tarumtarenanavigation.core.model.AccessPointCatalog
import com.hyandlh.tarumtarenanavigation.core.model.FingerprintAP
import com.hyandlh.tarumtarenanavigation.core.model.FingerprintEntry
import com.hyandlh.tarumtarenanavigation.core.model.Node
import com.hyandlh.tarumtarenanavigation.core.model.NodeType
import com.hyandlh.tarumtarenanavigation.core.observability.DiagnosticsRecorder
import com.hyandlh.tarumtarenanavigation.core.positioning.remote.PositioningApiService
import dagger.hilt.android.qualifiers.ApplicationContext
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
    @ApplicationContext private val context: Context,
    private val gson: Gson,
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

            val apiUrlFingerprints =
                "${GlobalConfig.KNN_API_BASE_URL}/${GlobalConfig.KNN_API_ENDPOINT_GETALLFINGERPRINTS}"

            diagnostics.recordEvent(
                "Loading fingerprints from KNN API",
                metadata = mapOf("url" to apiUrlFingerprints),
                source = "FingerprintRepository.loadDataRemote"
            )
            val fingerprints = apiService.getAllFingerprints(apiUrlFingerprints)

            _catalog.value = AccessPointCatalog(
                version = "fingerprint-1.0",
                fingerprints = fingerprints,
                nodes = nodeRegistry,
                lastUpdated = System.currentTimeMillis()
            )

            diagnostics.recordEvent(
                "Fingerprint catalog loaded",
                metadata = mapOf(
                    "nodes" to nodeRegistry.size.toString(),
                    "fingerprints" to fingerprints.size.toString()
                ),
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

    private fun loadDataLocal() {
        val nodeRegistry = mapOf(
            "elev-west" to Node("elev-west", "floor-2", 55.756, 33.909, NodeType.ELEVATOR, "West Elevator"),
            "TA244-door" to Node("TA244-door", "floor-2", 45.361, 53.354, NodeType.DESTINATION, "TA/244 door"),
            "TA245-door" to Node("TA245-door", "floor-2", 37.419, 53.354, NodeType.DESTINATION, "TA/245 door"),
            "TA246-door" to Node("TA246-door", "floor-2", 32.572, 53.354, NodeType.DESTINATION, "TA/246 door"),
            "TA254-door" to Node("TA254-door", "floor-2", 22.469, 35.544, NodeType.DESTINATION, "TA/254 door"),
            "TA255-door" to Node("TA255-door", "floor-2", 30.762, 35.544, NodeType.DESTINATION, "TA/255 door"),
            "TA256-door" to Node("TA256-door", "floor-2", 39.054, 35.544, NodeType.DESTINATION, "TA/256 door"),
            "TA257-door" to Node("TA257-door", "floor-2", 47.347, 35.544, NodeType.DESTINATION, "TA/257 door"),
            "center-of-road-north-of-elevwest" to Node("center-of-road-north-of-elevwest", "floor-2", 55.814, 44.887, NodeType.JUNCTION, "Center of road north of West Elevator"),
            "junc-TA244-246corr-east" to Node("junc-TA244-246corr-east", "floor-2", 55.814, 52.186, NodeType.JUNCTION, "East end of corridor along TA/244-246"),
            "junc-TA244-246corr-west" to Node("junc-TA244-246corr-west", "floor-2", 16.396, 52.186, NodeType.JUNCTION, "West end of corridor along TA/244-246"),
            "junc-TA254-257corr-west" to Node("junc-TA254-257corr-west", "floor-2", 16.396, 36.945, NodeType.JUNCTION, "West end of corridor along TA/254-257"),
            "west-of-TA246door-opp-TA254" to Node("west-of-TA246door-opp-TA254", "floor-2", 22.586, 53.354, NodeType.JUNCTION, "Slightly west of TA/246 door, opposite TA/254 door")
        )

        try {
            val jsonString = context.assets.open("wifiscans-25Jun2026.json").bufferedReader().use { it.readText() }
            val type = object : TypeToken<List<FingerprintJson>>() {}.type
            val rawData: List<FingerprintJson> = gson.fromJson(jsonString, type)

            val fingerprints = rawData.map { json ->
                FingerprintEntry(
                    locationId = json.location_id,
                    timestamp = json.timestamp,
                    scanId = json.scan_id,
                    apList = json.AP_list.map { ap -> FingerprintAP(ap.bssid, ap.rssi, ap.channel) }
                )
            }

            _catalog.value = AccessPointCatalog(
                version = "fingerprint-1.0",
                fingerprints = fingerprints,
                nodes = nodeRegistry,
                lastUpdated = System.currentTimeMillis()
            )
            diagnostics.recordEvent(
                "Local fingerprint asset loaded",
                metadata = mapOf("fingerprints" to fingerprints.size.toString()),
                source = "FingerprintRepository.loadDataLocal"
            )
        } catch (e: Exception) {
            _catalog.value = AccessPointCatalog(
                version = "empty",
                nodes = nodeRegistry,
                lastUpdated = System.currentTimeMillis()
            )
            diagnostics.recordError(
                "Local fingerprint asset missing or invalid",
                e,
                source = "FingerprintRepository.loadDataLocal"
            )
        }
    }

    private data class FingerprintJson(
        val timestamp: Long,
        val location_id: String,
        val scan_id: Int,
        val AP_list: List<FingerprintAPJson>
    )

    private data class FingerprintAPJson(
        val bssid: String,
        val rssi: Int,
        val channel: Int?
    )
}
