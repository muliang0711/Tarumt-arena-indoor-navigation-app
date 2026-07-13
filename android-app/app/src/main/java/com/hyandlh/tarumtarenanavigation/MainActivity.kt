package com.hyandlh.tarumtarenanavigation

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.widget.CheckBox
import android.widget.EditText
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.hyandlh.tarumtarenanavigation.core.common.CoordinateConverter
import com.hyandlh.tarumtarenanavigation.core.model.Node
import com.hyandlh.tarumtarenanavigation.core.model.PositionEstimate
import com.hyandlh.tarumtarenanavigation.core.model.TrackingState
import com.hyandlh.tarumtarenanavigation.databinding.ActivityMainBinding
import com.hyandlh.tarumtarenanavigation.feature.tracking.KnnDiagnosticsDialogFragment
import com.hyandlh.tarumtarenanavigation.feature.tracking.LogPanelDialogFragment
import com.hyandlh.tarumtarenanavigation.feature.tracking.NodeDetailsDialogFragment
import com.hyandlh.tarumtarenanavigation.feature.tracking.TrackingViewModel
import com.hyandlh.tarumtarenanavigation.feature.tracking.TransitionState
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val viewModel: TrackingViewModel by viewModels()

    @Inject
    lateinit var coordinateConverter: CoordinateConverter

    private var pendingPermissionAction: PendingPermissionAction? = null
    private var lastNoUsableReadingsDialogTimestamp: Long? = null

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.entries.all { it.value }
        if (allGranted) {
            when (pendingPermissionAction) {
                PendingPermissionAction.START_TRACKING -> viewModel.toggleTracking()
                PendingPermissionAction.ONE_OFF_SCAN -> viewModel.runOneOffScan()
                null -> Unit
            }
        } else {
            Toast.makeText(this, "Permissions required for tracking", Toast.LENGTH_SHORT).show()
        }
        pendingPermissionAction = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()
        observeViewModel()
    }

    private fun setupUI() {
        val mapResId = resources.getIdentifier("arena_second_floor_plan", "drawable", packageName)
        if (mapResId != 0) {
            binding.mapView.setMapImage(mapResId)
        }
        
        binding.mapView.setCoordinateConverter(coordinateConverter)
        
        binding.mapView.onApClickListener = { ap, reading ->
            val message = buildString {
                append("BSSID: ${ap.bssid}\n")
                if (reading != null) {
                    append("Current RSSI: ${reading.rssi} dBm\n")
                    append("Frequency: ${reading.frequency ?: "N/A"} MHz\n")
                } else {
                    append("Current RSSI: Not detected\n")
                }
                append("Coordinates: (${String.format(Locale.US, "%.2f", ap.x)}, ${String.format(Locale.US, "%.2f", ap.y)})\n")
                append("Floor: ${ap.floorId}\n")
                if (ap.metadata.isNotEmpty()) {
                    append("Metadata: ${ap.metadata}")
                }
            }

            AlertDialog.Builder(this)
                .setTitle("Info for AP ${ap.bssid}")
                .setMessage(message)
                .setPositiveButton("OK", null)
                .show()
        }

        binding.mapView.onNodeClickListener = { node ->
            NodeDetailsDialogFragment.newInstance(node.nodeId)
                .show(supportFragmentManager, NodeDetailsDialogFragment.TAG)
        }

        binding.toggleTrackingButton.setOnClickListener {
            if (hasPermissions()) {
                viewModel.toggleTracking()
            } else {
                requestPermissions(PendingPermissionAction.START_TRACKING)
            }
        }

        binding.oneOffScanButton.setOnClickListener {
            if (hasPermissions()) {
                viewModel.runOneOffScan()
            } else {
                requestPermissions(PendingPermissionAction.ONE_OFF_SCAN)
            }
        }

        binding.viewKnnDiagnosticsButton.setOnClickListener {
            KnnDiagnosticsDialogFragment().show(supportFragmentManager, KnnDiagnosticsDialogFragment.TAG)
        }

        binding.settingsButton.setOnClickListener {
            showSettingsDialog()
        }

        binding.pauseResumeButton.setOnClickListener {
            viewModel.togglePauseResume()
        }

        val initialDebugMode = binding.debugSwitch.isChecked
        viewModel.setDebugMode(initialDebugMode)
        binding.mapView.setDebugMode(initialDebugMode)

        binding.debugSwitch.setOnCheckedChangeListener { _, isChecked ->
            viewModel.setDebugMode(isChecked)
            binding.mapView.setDebugMode(isChecked)
        }

        binding.viewLogButton.setOnClickListener {
            LogPanelDialogFragment().show(supportFragmentManager, LogPanelDialogFragment.TAG)
        }
    }

    private fun observeViewModel() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch {
                    viewModel.trackingState.collect { state ->
                        updateStatusUI(state)
                    }
                }

                launch {
                    viewModel.currentPosition.collect { position ->
                        handlePositionUpdate(position)
                    }
                }
                
                launch {
                    viewModel.apLocations.collect { locations ->
                        binding.mapView.setApLocations(locations)
                    }
                }

                launch {
                    viewModel.nodes.collect { nodes ->
                        binding.mapView.setNodes(nodes)
                    }
                }

                launch {
                    viewModel.checkedNodeIds.collect { checkedNodeIds ->
                        binding.mapView.setCheckedNodeIds(checkedNodeIds)
                    }
                }

                launch {
                    viewModel.nearbyNodeSelection.collect { selection ->
                        binding.mapView.setNearbyNodeSelection(selection)
                    }
                }
                
                launch {
                    viewModel.latestSnapshot.collect { snapshot ->
                        if (snapshot != null) {
                            binding.mapView.setLatestReadings(snapshot.readings)
                        }
                    }
                }

                launch {
                    combine(viewModel.isPaused, viewModel.transitionState) { isPaused, transition ->
                        isPaused to transition
                    }.collect { (isPaused, transition) ->
                        binding.pauseResumeButton.isEnabled = transition == TransitionState.NONE
                        
                        val textRes = when (transition) {
                            TransitionState.PAUSING -> R.string.pausing_scanning
                            TransitionState.RESUMING -> R.string.resuming_scanning
                            TransitionState.NONE -> {
                                if (isPaused) R.string.resume_scanning else R.string.pause_scanning
                            }
                        }
                        binding.pauseResumeButton.setText(textRes)
                    }
                }

                launch {
                    viewModel.isOneOffScanRunning.collect { isRunning ->
                        binding.oneOffScanButton.isEnabled = !isRunning
                        binding.oneOffScanButton.setText(
                            if (isRunning) R.string.running_one_off_scan else R.string.run_one_off_scan
                        )
                    }
                }
            }
        }
    }

    private fun handlePositionUpdate(position: PositionEstimate?) {
        if (position?.diagnostics?.get("reason") == NO_USABLE_LIVE_READINGS_REASON) {
            binding.mapView.setUserPosition(null)
            showNoUsableReadingsDialog(position.timestamp)
            return
        }

        binding.mapView.setUserPosition(position)
        if (position != null) {
            val time = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date(position.timestamp))
            binding.lastUpdateText.text = getString(R.string.last_updated, time)
        }
    }

    private fun showNoUsableReadingsDialog(timestamp: Long) {
        if (lastNoUsableReadingsDialogTimestamp == timestamp) return
        lastNoUsableReadingsDialogTimestamp = timestamp

        AlertDialog.Builder(this)
            .setTitle(R.string.no_usable_readings_title)
            .setMessage(buildNoUsableReadingsMessage())
            .setPositiveButton(android.R.string.ok, null)
            .show()
    }

    private fun buildNoUsableReadingsMessage(): String {
        val filterSsid = viewModel.filterSsid.value
        return if (filterSsid.isBlank()) {
            getString(R.string.no_usable_readings_message_no_filter)
        } else {
            getString(R.string.no_usable_readings_message, filterSsid)
        }
    }

    private fun showSettingsDialog() {
        val nodes = viewModel.nodes.value.sortedWith(nodeComparator)
        viewModel.syncDefaultCheckedNodes(nodes)
        val availableIds = nodes.map { it.nodeId }.toSet()
        val selectedIds = viewModel.checkedNodeIds.value
            .filter { it in availableIds }
            .toMutableSet()
        val initialFilterSsid = viewModel.filterSsid.value
        val initialCloseNodeThresholdMeters = viewModel.closeNodeThresholdMeters.value
        val initialSelectedIds = selectedIds.toSet()
        val groups = nodeSelectionGroups()

        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(8), dp(4), dp(8), dp(4))
        }

        val filterSsidTitle = TextView(this).apply {
            text = getString(R.string.filter_ssid)
            setTypeface(typeface, Typeface.BOLD)
        }
        content.addView(filterSsidTitle)

        val filterSsidRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
        }

        val filterSsidInput = EditText(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1f
            )
            setText(initialFilterSsid)
            setSingleLine(true)
            hint = getString(R.string.filter_ssid_hint)
        }
        filterSsidRow.addView(filterSsidInput)

        val clearFilterSsidButton = ImageButton(this).apply {
            setImageResource(android.R.drawable.ic_menu_close_clear_cancel)
            contentDescription = getString(R.string.clear_filter_ssid)
            setBackgroundColor(ContextCompat.getColor(this@MainActivity, android.R.color.transparent))
            setOnClickListener {
                filterSsidInput.text?.clear()
            }
        }
        filterSsidRow.addView(clearFilterSsidButton)
        content.addView(filterSsidRow)

        val closeNodeThresholdTitle = TextView(this).apply {
            text = getString(R.string.close_node_threshold)
            setTypeface(typeface, Typeface.BOLD)
            setPadding(0, dp(12), 0, 0)
        }
        content.addView(closeNodeThresholdTitle)

        val closeNodeThresholdInput = EditText(this).apply {
            setText(String.format(Locale.US, "%.1f", initialCloseNodeThresholdMeters))
            setSingleLine(true)
            hint = getString(R.string.close_node_threshold_hint)
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
        }
        content.addView(closeNodeThresholdInput)

        val groupCheckBoxes = mutableMapOf<String, CheckBox>()
        val nodeCheckBoxes = mutableMapOf<String, CheckBox>()
        var isUpdating = false

        fun refreshGroupChecks() {
            isUpdating = true
            groups.forEach { group ->
                val activeNodeIds = group.nodeIds.filter { it in availableIds }
                val checkBox = groupCheckBoxes[group.id] ?: return@forEach
                checkBox.isEnabled = activeNodeIds.isNotEmpty()
                checkBox.isChecked = activeNodeIds.isNotEmpty() && activeNodeIds.all { it in selectedIds }
            }
            isUpdating = false
        }

        val groupTitle = TextView(this).apply {
            text = getString(R.string.node_selection_groups)
            setTypeface(typeface, Typeface.BOLD)
            setPadding(0, dp(12), 0, 0)
        }
        content.addView(groupTitle)

        groups.forEach { group ->
            val checkBox = CheckBox(this).apply {
                text = group.label
                setPadding(0, dp(2), 0, dp(2))
                setOnCheckedChangeListener { _, isChecked ->
                    if (isUpdating) return@setOnCheckedChangeListener
                    val activeNodeIds = group.nodeIds.filter { it in availableIds }
                    if (isChecked) {
                        selectedIds.addAll(activeNodeIds)
                    } else {
                        selectedIds.removeAll(activeNodeIds)
                    }
                    isUpdating = true
                    activeNodeIds.forEach { nodeId ->
                        nodeCheckBoxes[nodeId]?.isChecked = isChecked
                    }
                    isUpdating = false
                    refreshGroupChecks()
                }
            }
            groupCheckBoxes[group.id] = checkBox
            content.addView(checkBox)
        }

        val nodeTitle = TextView(this).apply {
            text = getString(R.string.node_selection_individual_nodes)
            setTypeface(typeface, Typeface.BOLD)
            setPadding(0, dp(12), 0, 0)
        }
        content.addView(nodeTitle)

        nodes.forEach { node ->
            val checkBox = CheckBox(this).apply {
                text = buildNodeLabel(node)
                isChecked = node.nodeId in selectedIds
                setPadding(0, dp(2), 0, dp(2))
                setOnCheckedChangeListener { _, isChecked ->
                    if (isUpdating) return@setOnCheckedChangeListener
                    if (isChecked) {
                        selectedIds.add(node.nodeId)
                    } else {
                        selectedIds.remove(node.nodeId)
                    }
                    refreshGroupChecks()
                }
            }
            nodeCheckBoxes[node.nodeId] = checkBox
            content.addView(checkBox)
        }

        refreshGroupChecks()

        val scrollView = ScrollView(this).apply {
            addView(content)
        }

        fun hasUnsavedSettingsChanges(): Boolean {
            return filterSsidInput.text?.toString()?.trim().orEmpty() != initialFilterSsid ||
                parseCloseNodeThreshold(closeNodeThresholdInput.text?.toString().orEmpty()) != initialCloseNodeThresholdMeters ||
                selectedIds.toSet() != initialSelectedIds
        }

        val dialog = AlertDialog.Builder(this)
            .setTitle(R.string.settings)
            .setView(scrollView)
            .setNegativeButton(android.R.string.cancel, null)
            .setPositiveButton(R.string.save, null)
            .create()

        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setOnClickListener {
                if (hasUnsavedSettingsChanges()) {
                    showDiscardSettingsChangesDialog {
                        dialog.dismiss()
                    }
                } else {
                    dialog.dismiss()
                }
            }

            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                viewModel.setFilterSsid(filterSsidInput.text?.toString().orEmpty())
                viewModel.setCloseNodeThresholdMeters(
                    parseCloseNodeThreshold(closeNodeThresholdInput.text?.toString().orEmpty())
                )
                viewModel.setCheckedNodeIds(selectedIds.toSet())
                Toast.makeText(
                    this,
                    getString(R.string.settings_saved),
                    Toast.LENGTH_SHORT
                ).show()
                dialog.dismiss()
            }
        }
        dialog.show()
    }

    private fun parseCloseNodeThreshold(value: String): Double {
        return value.trim().toDoubleOrNull()
            ?.takeIf { it.isFinite() && it > 0.0 }
            ?: viewModel.closeNodeThresholdMeters.value
    }

    private fun showDiscardSettingsChangesDialog(onDiscard: () -> Unit) {
        AlertDialog.Builder(this)
            .setTitle(R.string.discard_settings_changes_title)
            .setMessage(R.string.discard_settings_changes_message)
            .setNegativeButton(android.R.string.cancel, null)
            .setPositiveButton(R.string.discard) { _, _ ->
                onDiscard()
            }
            .show()
    }

    private fun buildNodeLabel(node: Node): String {
        return if (node.name.isNullOrBlank()) {
            node.nodeId
        } else {
            "${node.nodeId} - ${node.name}"
        }
    }

    private fun nodeSelectionGroups(): List<NodeSelectionGroup> {
        return listOf(
            NodeSelectionGroup(
                id = "ta254_257_corridor",
                label = "Group: node-16 to node-20 + node-1",
                nodeIds = (16..20).map { "node-$it" } + "node-1"
            ),
            NodeSelectionGroup(
                id = "kongdi_grid",
                label = "Group: kongdi-1 to kongdi-20 + node-1 + node-2",
                nodeIds = (1..20).map { "kongdi-$it" } + listOf("node-1", "node-2")
            ),
            NodeSelectionGroup(
                id = "ta244_246_corridor",
                label = "Group: node-12 to node-15 + node-2 + west-of-TA246door-opp-TA254",
                nodeIds = (12..15).map { "node-$it" } + listOf("node-2", "west-of-TA246door-opp-TA254")
            )
        )
    }

    private val nodeComparator = compareBy<Node>(
        { nodeSortCategory(it.nodeId) },
        { nodeSortNumber(it.nodeId) },
        { it.nodeId }
    )

    private fun nodeSortCategory(nodeId: String): Int {
        return when {
            nodeId.startsWith("node-") -> 0
            nodeId.startsWith("kongdi-") -> 1
            else -> 2
        }
    }

    private fun nodeSortNumber(nodeId: String): Int {
        return nodeId.substringAfterLast("-", "").toIntOrNull() ?: Int.MAX_VALUE
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
    }

    private fun updateStatusUI(state: TrackingState) {
        when (state) {
            is TrackingState.Idle -> {
                binding.statusText.setText(R.string.status_idle)
                binding.toggleTrackingButton.setText(R.string.start_tracking)
                binding.pauseResumeButton.visibility = View.GONE
            }
            is TrackingState.LoadingCatalog -> {
                binding.statusText.setText(R.string.status_loading_aps)
                binding.toggleTrackingButton.setText(R.string.stop_tracking)
                binding.pauseResumeButton.visibility = View.GONE
            }
            is TrackingState.Scanning -> {
                binding.statusText.setText(R.string.status_scanning)
                binding.toggleTrackingButton.setText(R.string.stop_tracking)
                binding.pauseResumeButton.visibility = View.VISIBLE
            }
            is TrackingState.Positioning -> {
                binding.statusText.setText(R.string.status_positioning)
                binding.toggleTrackingButton.setText(R.string.stop_tracking)
                binding.pauseResumeButton.visibility = View.VISIBLE
            }
            is TrackingState.Error -> {
                binding.statusText.text = getString(R.string.status_error, state.message)
                binding.toggleTrackingButton.setText(R.string.start_tracking)
                binding.pauseResumeButton.visibility = View.GONE
            }
            is TrackingState.Paused -> {
                binding.statusText.setText(R.string.status_paused)
                binding.toggleTrackingButton.setText(R.string.stop_tracking)
                binding.pauseResumeButton.visibility = View.VISIBLE
            }
            else -> {}
        }
    }

    private fun hasPermissions(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_WIFI_STATE) == PackageManager.PERMISSION_GRANTED &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.CHANGE_WIFI_STATE) == PackageManager.PERMISSION_GRANTED
    }

    private fun requestPermissions(action: PendingPermissionAction) {
        pendingPermissionAction = action
        requestPermissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_WIFI_STATE,
                Manifest.permission.CHANGE_WIFI_STATE
            )
        )
    }

    private enum class PendingPermissionAction {
        START_TRACKING,
        ONE_OFF_SCAN
    }

    private companion object {
        const val NO_USABLE_LIVE_READINGS_REASON = "no_usable_live_readings"
    }
}

private data class NodeSelectionGroup(
    val id: String,
    val label: String,
    val nodeIds: List<String>
)
