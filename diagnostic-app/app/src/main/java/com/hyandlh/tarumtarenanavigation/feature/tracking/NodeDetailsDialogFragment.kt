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
import com.hyandlh.tarumtarenanavigation.core.model.FingerprintEntry
import com.hyandlh.tarumtarenanavigation.core.model.Node
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import com.hyandlh.tarumtarenanavigation.databinding.DialogNodeDetailsBinding
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.pow
import kotlin.math.sqrt

class NodeDetailsDialogFragment : DialogFragment() {

    private var _binding: DialogNodeDetailsBinding? = null
    private val binding get() = _binding!!

    private val viewModel: TrackingViewModel by activityViewModels()
    private lateinit var adapter: FingerprintAdapter
    private val dateFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogNodeDetailsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val nodeId = arguments?.getString(ARG_NODE_ID) ?: return dismiss()
        
        setupRecyclerView()

        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                combine(
                    viewModel.nodes,
                    viewModel.fingerprints,
                    viewModel.latestSnapshot
                ) { nodes, fingerprints, snapshot ->
                    Triple(nodes, fingerprints, snapshot)
                }.collect { (nodes, fingerprints, snapshot) ->
                    val node = nodes.find { it.nodeId == nodeId }
                    if (node != null) {
                        setupUI(node)
                        updateComparison(fingerprints, snapshot, nodeId)
                    }
                }
            }
        }

        binding.closeButton.setOnClickListener {
            dismiss()
        }
    }

    private fun setupUI(node: Node) {
        binding.nodeTitle.text = node.name ?: node.nodeId
        binding.nodeInfo.text = String.format(
            Locale.US,
            "ID: %s | Floor: %s | Type: %s | (%.2f, %.2f)",
            node.nodeId,
            node.floorId,
            node.type.name,
            node.x,
            node.y
        )
    }

    private fun setupRecyclerView() {
        adapter = FingerprintAdapter()
        binding.fingerprintRecyclerView.layoutManager = LinearLayoutManager(context)
        binding.fingerprintRecyclerView.adapter = adapter
    }

    private fun updateComparison(
        allFingerprints: List<FingerprintEntry>,
        snapshot: WifiScanSnapshot?,
        nodeId: String
    ) {
        val nodeFingerprints = allFingerprints.filter { it.locationId == nodeId }
        
        // 1. Calculate RSSI distributions for the dotted graph
        val rssiDistributions = mutableMapOf<String, MutableMap<Int, Int>>()
        val fingerprintSums = mutableMapOf<String, MutableList<Int>>()

        nodeFingerprints.forEach { entry ->
            entry.apList.forEach { ap ->
                // For the graph
                val dist = rssiDistributions.getOrPut(ap.bssid) { mutableMapOf() }
                dist[ap.rssi] = dist.getOrDefault(ap.rssi, 0) + 1
                
                // For Euclidean distance calculation (averaging)
                fingerprintSums.getOrPut(ap.bssid) { mutableListOf() }.add(ap.rssi)
            }
        }

        val latestScanMap = snapshot?.readings?.associate { it.bssid to it.rssi } ?: emptyMap()

        // 2. Create items for the adapter
        val allBssids = (rssiDistributions.keys + latestScanMap.keys).distinct()
        val comparisonItems = allBssids.map { bssid ->
            val frequencies = rssiDistributions[bssid] ?: emptyMap()
            val latestRssi = latestScanMap[bssid]
            FingerprintComparisonItem(
                bssid = bssid,
                rssiFrequencies = frequencies,
                latestScanRssi = latestRssi,
                isGrayedOut = frequencies.isNotEmpty() && latestRssi == null
            )
        }.sortedByDescending { it.latestScanRssi ?: -200 }

        adapter.submitList(comparisonItems)

        // 3. Update Scan Time
        if (snapshot != null) {
            binding.scanUpdatedText.text = "Wifi scan last updated: ${dateFormat.format(Date(snapshot.timestamp))}"
        } else {
            binding.scanUpdatedText.text = "Wifi scan last updated: N/A"
        }

        // 4. Calculate Euclidean Distance (using average fingerprint)
        if (fingerprintSums.isNotEmpty() && snapshot != null) {
            val avgFingerprint = fingerprintSums.mapValues { it.value.average().toInt() }
            val distance = calculateDistance(avgFingerprint, latestScanMap)
            binding.euclideanDistanceText.text = String.format(Locale.US, "Euclidean distance: %.2f", distance)
        } else {
            binding.euclideanDistanceText.text = "Euclidean distance: N/A"
        }
    }

    private fun calculateDistance(fingerprint: Map<String, Int>, scan: Map<String, Int>): Double {
        val penaltyRssi = -100.0
        val allBssids = (fingerprint.keys + scan.keys).distinct()
        var sumSquaredDiff = 0.0
        for (bssid in allBssids) {
            val fRssi = fingerprint[bssid]?.toDouble() ?: penaltyRssi
            val sRssi = scan[bssid]?.toDouble() ?: penaltyRssi
            sumSquaredDiff += (fRssi - sRssi).pow(2)
        }
        return sqrt(sumSquaredDiff)
    }

    override fun onStart() {
        super.onStart()
        dialog?.window?.setLayout(
            ViewGroup.LayoutParams.MATCH_PARENT,
            (resources.displayMetrics.heightPixels * 0.8).toInt()
        )
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        const val TAG = "NodeDetailsDialogFragment"
        private const val ARG_NODE_ID = "node_id"

        fun newInstance(nodeId: String): NodeDetailsDialogFragment {
            return NodeDetailsDialogFragment().apply {
                arguments = Bundle().apply {
                    putString(ARG_NODE_ID, nodeId)
                }
            }
        }
    }
}
