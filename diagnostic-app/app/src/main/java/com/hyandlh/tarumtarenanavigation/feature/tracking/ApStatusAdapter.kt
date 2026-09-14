package com.hyandlh.tarumtarenanavigation.feature.tracking

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanReading
import com.hyandlh.tarumtarenanavigation.databinding.ItemApStatusBinding

class ApStatusAdapter : ListAdapter<WifiScanReading, ApStatusAdapter.ApViewHolder>(ApDiffCallback()) {

    private val expandedStates = mutableSetOf<String>()

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ApViewHolder {
        val binding = ItemApStatusBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ApViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ApViewHolder, position: Int) {
        val reading = getItem(position)
        holder.bind(reading, expandedStates.contains(reading.bssid)) { isExpanded ->
            if (isExpanded) {
                expandedStates.add(reading.bssid)
            } else {
                expandedStates.remove(reading.bssid)
            }
            notifyItemChanged(position)
        }
    }

    class ApViewHolder(private val binding: ItemApStatusBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(reading: WifiScanReading, isExpanded: Boolean, onToggle: (Boolean) -> Unit) {
            binding.bssidText.text = reading.bssid
            binding.rssiText.text = "${reading.rssi} dBm"
            
            binding.detailsLayout.visibility = if (isExpanded) View.VISIBLE else View.GONE
            
            binding.frequencyText.text = "Frequency: ${reading.frequency ?: "N/A"} MHz"
            binding.ssidText.text = "SSID: ${reading.ssid ?: "Hidden"}"
            binding.metadataText.text = "Metadata: ${reading.metadata}"

            binding.root.setOnClickListener {
                onToggle(!isExpanded)
            }
        }
    }

    private class ApDiffCallback : DiffUtil.ItemCallback<WifiScanReading>() {
        override fun areItemsTheSame(oldItem: WifiScanReading, newItem: WifiScanReading): Boolean = 
            oldItem.bssid == newItem.bssid
        override fun areContentsTheSame(oldItem: WifiScanReading, newItem: WifiScanReading): Boolean = 
            oldItem == newItem
    }
}
