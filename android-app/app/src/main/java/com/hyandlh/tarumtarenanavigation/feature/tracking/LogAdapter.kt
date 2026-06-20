package com.hyandlh.tarumtarenanavigation.feature.tracking

import android.graphics.Color
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.hyandlh.tarumtarenanavigation.core.observability.LogEntry
import com.hyandlh.tarumtarenanavigation.databinding.ItemLogBinding

class LogAdapter : ListAdapter<LogEntry, LogAdapter.LogViewHolder>(LogDiffCallback()) {

    init {
        // Essential for preventing layout shifts when items are removed from the top
        setHasStableIds(true)
    }

    override fun getItemId(position: Int): Long = getItem(position).id

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): LogViewHolder {
        val binding = ItemLogBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return LogViewHolder(binding)
    }

    override fun onBindViewHolder(holder: LogViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class LogViewHolder(private val binding: ItemLogBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(entry: LogEntry) {
            binding.logText.text = "[${entry.formattedTime}] ${entry.message}"
            val color = when (entry.level) {
                LogEntry.LogLevel.ERROR -> Color.RED
                LogEntry.LogLevel.WARNING -> Color.parseColor("#FFA500") // Orange
                LogEntry.LogLevel.DEBUG -> Color.BLUE
                else -> Color.BLACK
            }
            binding.logText.setTextColor(color)
        }
    }

    private class LogDiffCallback : DiffUtil.ItemCallback<LogEntry>() {
        override fun areItemsTheSame(oldItem: LogEntry, newItem: LogEntry): Boolean =
            oldItem.id == newItem.id
        override fun areContentsTheSame(oldItem: LogEntry, newItem: LogEntry): Boolean = 
            oldItem == newItem
    }
}
