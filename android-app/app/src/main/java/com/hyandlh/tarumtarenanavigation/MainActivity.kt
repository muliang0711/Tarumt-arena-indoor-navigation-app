package com.hyandlh.tarumtarenanavigation

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
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
import com.hyandlh.tarumtarenanavigation.core.model.TrackingState
import com.hyandlh.tarumtarenanavigation.databinding.ActivityMainBinding
import com.hyandlh.tarumtarenanavigation.feature.tracking.LogPanelDialogFragment
import com.hyandlh.tarumtarenanavigation.feature.tracking.TrackingViewModel
import dagger.hilt.android.AndroidEntryPoint
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

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.entries.all { it.value }
        if (allGranted) {
            viewModel.toggleTracking()
        } else {
            Toast.makeText(this, "Permissions required for tracking", Toast.LENGTH_SHORT).show()
        }
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

        binding.toggleTrackingButton.setOnClickListener {
            if (hasPermissions()) {
                viewModel.toggleTracking()
            } else {
                requestPermissions()
            }
        }

        binding.pauseResumeButton.setOnClickListener {
            viewModel.togglePauseResume()
        }

        binding.debugSwitch.setOnCheckedChangeListener { _, isChecked ->
            viewModel.toggleDebugMode()
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
                        binding.mapView.setUserPosition(position)
                        if (position != null) {
                            val time = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date(position.timestamp))
                            binding.lastUpdateText.text = getString(R.string.last_updated, time)
                        }
                    }
                }
                
                launch {
                    viewModel.apLocations.collect { locations ->
                        binding.mapView.setApLocations(locations)
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
                    viewModel.isPaused.collect { isPaused ->
                        updatePauseResumeButton(isPaused)
                    }
                }

                launch {
                    viewModel.isPausingOrResuming.collect { transitioning ->
                        binding.pauseResumeButton.isEnabled = !transitioning
                        if (transitioning) {
                            val textRes = if (viewModel.isPaused.value) R.string.resuming_scanning else R.string.pausing_scanning
                            binding.pauseResumeButton.setText(textRes)
                        }
                    }
                }
            }
        }
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

    private fun updatePauseResumeButton(isPaused: Boolean) {
        if (!viewModel.isPausingOrResuming.value) {
            val textRes = if (isPaused) R.string.resume_scanning else R.string.pause_scanning
            binding.pauseResumeButton.setText(textRes)
        }
    }

    private fun hasPermissions(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_WIFI_STATE) == PackageManager.PERMISSION_GRANTED &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.CHANGE_WIFI_STATE) == PackageManager.PERMISSION_GRANTED
    }

    private fun requestPermissions() {
        requestPermissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_WIFI_STATE,
                Manifest.permission.CHANGE_WIFI_STATE
            )
        )
    }
}
