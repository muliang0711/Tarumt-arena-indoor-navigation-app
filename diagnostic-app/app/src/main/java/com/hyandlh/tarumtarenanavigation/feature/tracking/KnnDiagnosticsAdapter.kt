package com.hyandlh.tarumtarenanavigation.feature.tracking

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.hyandlh.tarumtarenanavigation.core.model.KnnNodeDiagnostic
import com.hyandlh.tarumtarenanavigation.databinding.ItemKnnNodeDiagnosticBinding
import java.util.Locale

class KnnDiagnosticsAdapter :
    ListAdapter<KnnNodeDiagnostic, KnnDiagnosticsAdapter.ViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemKnnNodeDiagnosticBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class ViewHolder(private val binding: ItemKnnNodeDiagnosticBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: KnnNodeDiagnostic) {
            val selectedMarker = if (item.selectedNeighborCount > 0) " selected" else ""
            binding.nodeTitleText.text = "#${item.rank} ${item.nodeId}$selectedMarker"

            val coordinates = if (item.x != null && item.y != null) {
                String.format(Locale.US, "(%.2f, %.2f)", item.x, item.y)
            } else {
                "(unknown)"
            }
            binding.nodeDetailsText.text = String.format(
                Locale.US,
                "%s\nbestDist=%.2f scanId=%d fingerprints=%d\nmatched=%d missingFromScan=%d extraFromScan=%d\ncontribution=%.1f%% weight=%.5f",
                item.nodeName ?: "Unnamed node",
                item.bestDistance,
                item.bestScanId,
                item.fingerprintCount,
                item.matchedBssidCount,
                item.missingFromScanCount,
                item.extraFromScanCount,
                item.contributionPercent * 100.0,
                item.contributionWeight
            ) + "\ncoord=$coordinates floor=${item.floorId ?: "unknown"}"
            binding.contributionBar.progress = (item.contributionPercent * 1000.0).toInt().coerceIn(0, 1000)
        }
    }

    private class DiffCallback : DiffUtil.ItemCallback<KnnNodeDiagnostic>() {
        override fun areItemsTheSame(oldItem: KnnNodeDiagnostic, newItem: KnnNodeDiagnostic): Boolean =
            oldItem.nodeId == newItem.nodeId

        override fun areContentsTheSame(oldItem: KnnNodeDiagnostic, newItem: KnnNodeDiagnostic): Boolean =
            oldItem == newItem
    }
}
