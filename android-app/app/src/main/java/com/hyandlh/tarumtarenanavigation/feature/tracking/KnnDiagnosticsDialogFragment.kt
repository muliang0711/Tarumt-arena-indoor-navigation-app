package com.hyandlh.tarumtarenanavigation.feature.tracking

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.DialogFragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import com.hyandlh.tarumtarenanavigation.core.model.KnnDiagnosticReport
import com.hyandlh.tarumtarenanavigation.core.model.PositionEstimate
import com.hyandlh.tarumtarenanavigation.databinding.DialogKnnDiagnosticsBinding
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class KnnDiagnosticsDialogFragment : DialogFragment() {

    private var _binding: DialogKnnDiagnosticsBinding? = null
    private val binding get() = _binding!!

    private val viewModel: TrackingViewModel by activityViewModels()
    private val adapter = KnnDiagnosticsAdapter()
    private val dateFormat = SimpleDateFormat("HH:mm:ss.SSS", Locale.getDefault())

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogKnnDiagnosticsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.nodeDiagnosticsRecyclerView.layoutManager = LinearLayoutManager(context)
        binding.nodeDiagnosticsRecyclerView.adapter = adapter

        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                combine(
                    viewModel.knnDiagnostics,
                    viewModel.currentPosition,
                    viewModel.lastSavedScanPath,
                    viewModel.lastSavedDiagnosticsPath
                ) { report, apiEstimate, savedPath, diagnosticsPath ->
                    KnnDiagnosticsUiState(report, apiEstimate, savedPath, diagnosticsPath)
                }.collect { state ->
                    updateUi(
                        report = state.report,
                        apiEstimate = state.apiEstimate,
                        savedPath = state.savedScanPath,
                        savedDiagnosticsPath = state.savedDiagnosticsPath
                    )
                }
            }
        }

        binding.closeButton.setOnClickListener {
            dismiss()
        }
    }

    private fun updateUi(
        report: KnnDiagnosticReport?,
        apiEstimate: PositionEstimate?,
        savedPath: String?,
        savedDiagnosticsPath: String?
    ) {
        if (report == null) {
            binding.summaryText.text = "No KNN diagnostics yet. Run tracking or use the one-off scan button."
            adapter.submitList(emptyList())
            return
        }

        binding.summaryText.text = buildSummary(report, apiEstimate, savedPath, savedDiagnosticsPath)
        adapter.submitList(report.nodeSummaries.take(MAX_NODE_ROWS))
    }

    private fun buildSummary(
        report: KnnDiagnosticReport,
        apiEstimate: PositionEstimate?,
        savedPath: String?,
        savedDiagnosticsPath: String?
    ): String {
        val local = report.localEstimate
        val api = apiEstimate?.let {
            String.format(Locale.US, "(%.2f, %.2f) floor=%s conf=%.4f", it.x, it.y, it.floorId, it.confidence)
        } ?: "N/A"
        val localEstimate = String.format(
            Locale.US,
            "(%.2f, %.2f) floor=%s conf=%.4f",
            local.x,
            local.y,
            local.floorId,
            local.confidence
        )
        val neighbors = report.nearestNeighbors.joinToString("\n") { neighbor ->
            String.format(
                Locale.US,
                "#%d %s scanId=%d dist=%.2f weight=%.1f%% matched=%d missing=%d extra=%d",
                neighbor.rank,
                neighbor.locationId,
                neighbor.scanId,
                neighbor.distance,
                neighbor.normalizedWeight * 100.0,
                neighbor.matchedBssidCount,
                neighbor.missingFromScanCount,
                neighbor.extraFromScanCount
            )
        }
        val floorWeights = report.floorWeights.entries.joinToString(", ") { (floor, weight) ->
            String.format(Locale.US, "%s=%.5f", floor, weight)
        }.ifEmpty { "none" }

        return buildString {
            appendLine("scan=${dateFormat.format(Date(report.snapshotTimestamp))} k=${report.k} penalty=${report.penaltyRssi}")
            appendLine("readings total=${report.totalReadings} used=${report.usedReadings} ignored=${report.ignoredReadings} uniqueBssid=${report.uniqueLiveBssidCount}")
            appendLine("catalog fingerprints=${report.fingerprintCount} nodes=${report.nodeCount}")
            appendLine("all fingerprint distances=${report.allFingerprintDistances.size}")
            appendLine("API estimate:   $api")
            appendLine("Local replay:   $localEstimate")
            appendLine("floorWeights:   $floorWeights")
            appendLine("scan JSON:      ${savedPath ?: "N/A"}")
            appendLine("diagnostics JSON: ${savedDiagnosticsPath ?: "N/A"}")
            appendLine()
            appendLine("nearest fingerprints:")
            append(neighbors.ifEmpty { "none" })
        }
    }

    override fun onStart() {
        super.onStart()
        dialog?.window?.setLayout(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        const val TAG = "KnnDiagnosticsDialogFragment"
        private const val MAX_NODE_ROWS = 40
    }
}

private data class KnnDiagnosticsUiState(
    val report: KnnDiagnosticReport?,
    val apiEstimate: PositionEstimate?,
    val savedScanPath: String?,
    val savedDiagnosticsPath: String?
)
