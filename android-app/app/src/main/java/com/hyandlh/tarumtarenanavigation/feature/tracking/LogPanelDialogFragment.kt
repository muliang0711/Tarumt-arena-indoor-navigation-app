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
import androidx.recyclerview.widget.RecyclerView
import com.hyandlh.tarumtarenanavigation.R
import com.hyandlh.tarumtarenanavigation.databinding.DialogLogPanelBinding
import kotlinx.coroutines.launch

class LogPanelDialogFragment : DialogFragment() {

    private var _binding: DialogLogPanelBinding? = null
    private val binding get() = _binding!!
    
    private val viewModel: TrackingViewModel by activityViewModels()
    
    private val logAdapter = LogAdapter()
    private val apStatusAdapter = ApStatusAdapter()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setStyle(STYLE_NORMAL, R.style.Theme_TARUMTArenaNavigation)
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogLogPanelBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupRecyclerViews()
        observeViewModel()

        binding.closeButton.setOnClickListener {
            dismiss()
        }
    }

    private fun setupRecyclerViews() {
        binding.logRecyclerView.apply {
            // Standard top-down layout manager
            layoutManager = LinearLayoutManager(context)
            adapter = logAdapter
        }

        binding.apStatusRecyclerView.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = apStatusAdapter
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch {
                    viewModel.logs.collect { logs ->
                        val wasAtBottom = isAtBottom()
                        logAdapter.submitList(logs) {
                            // If the user has manually scrolled up to read, do NOT move the view.
                            // Only auto-scroll to the bottom if they were already there.
                            if (wasAtBottom && logs.isNotEmpty()) {
                                binding.logRecyclerView.scrollToPosition(logs.size - 1)
                            }
                        }
                    }
                }

                launch {
                    viewModel.latestSnapshot.collect { snapshot ->
                        apStatusAdapter.submitList(snapshot?.readings ?: emptyList())
                    }
                }
            }
        }
    }

    /**
     * Detects if the user is currently at the bottom of the log list.
     */
    private fun isAtBottom(): Boolean {
        // canScrollVertically(1) returns false if the view cannot be scrolled down further.
        return !binding.logRecyclerView.canScrollVertically(1)
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
        const val TAG = "LogPanelDialogFragment"
    }
}
