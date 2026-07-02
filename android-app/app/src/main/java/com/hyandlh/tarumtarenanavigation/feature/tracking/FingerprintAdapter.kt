package com.hyandlh.tarumtarenanavigation.feature.tracking

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.hyandlh.tarumtarenanavigation.databinding.ItemFingerprintBinding

data class FingerprintComparisonItem(
    val bssid: String,
    val rssiFrequencies: Map<Int, Int>,
    val latestScanRssi: Int?,
    val isGrayedOut: Boolean
)

class FingerprintAdapter : ListAdapter<FingerprintComparisonItem, FingerprintAdapter.ViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemFingerprintBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class ViewHolder(private val binding: ItemFingerprintBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(item: FingerprintComparisonItem) {
            binding.bssidText.text = item.bssid
            binding.rssiDistributionView.setData(
                frequencies = item.rssiFrequencies,
                latest = item.latestScanRssi,
                grayedOut = item.isGrayedOut
            )
        }
    }

    private class DiffCallback : DiffUtil.ItemCallback<FingerprintComparisonItem>() {
        override fun areItemsTheSame(oldItem: FingerprintComparisonItem, newItem: FingerprintComparisonItem): Boolean =
            oldItem.bssid == newItem.bssid
        override fun areContentsTheSame(oldItem: FingerprintComparisonItem, newItem: FingerprintComparisonItem): Boolean =
            oldItem == newItem
    }
}
