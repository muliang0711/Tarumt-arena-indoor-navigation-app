package com.hyandlh.tarumtarenanavigation.core.positioning

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.google.gson.Gson
import com.hyandlh.tarumtarenanavigation.core.model.OneOffKnnDiagnosticsArtifact
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class KnnDiagnosticsJsonStore @Inject constructor(
    @ApplicationContext private val context: Context,
    private val gson: Gson
) {
    fun save(artifact: OneOffKnnDiagnosticsArtifact): SavedKnnDiagnosticsJson {
        val fileName = "knn-diagnostics-${artifact.snapshotTimestamp}.json"
        val json = gson.toJson(artifact)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveToPublicDocuments(fileName, json)?.let { return it }
        }

        return saveToAppExternalDocuments(fileName, json)
    }

    private fun saveToPublicDocuments(fileName: String, json: String): SavedKnnDiagnosticsJson? {
        val relativePath = "${Environment.DIRECTORY_DOCUMENTS}/Arena Navigation/knn-diagnostics"
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
            put(MediaStore.MediaColumns.MIME_TYPE, "application/json")
            put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }

        val resolver = context.contentResolver
        val collection = MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        var uri: Uri? = null
        return try {
            uri = resolver.insert(collection, values) ?: return null
            resolver.openOutputStream(uri)?.use { outputStream ->
                outputStream.write(json.toByteArray(Charsets.UTF_8))
            } ?: return null
            values.clear()
            values.put(MediaStore.MediaColumns.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            SavedKnnDiagnosticsJson(
                fileName = fileName,
                path = "$relativePath/$fileName",
                uri = uri.toString()
            )
        } catch (_: Exception) {
            uri?.let { resolver.delete(it, null, null) }
            null
        }
    }

    private fun saveToAppExternalDocuments(fileName: String, json: String): SavedKnnDiagnosticsJson {
        val baseDirectory = context.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS)
            ?: context.filesDir
        val directory = File(baseDirectory, "knn-diagnostics")
        if (!directory.exists()) {
            directory.mkdirs()
        }

        val file = File(directory, fileName)
        file.writeText(json)
        return SavedKnnDiagnosticsJson(
            fileName = fileName,
            path = file.absolutePath,
            uri = null
        )
    }
}

data class SavedKnnDiagnosticsJson(
    val fileName: String,
    val path: String,
    val uri: String?
)
