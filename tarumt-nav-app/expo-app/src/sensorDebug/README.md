# Sensor Debug

Development-only bridge from the Expo Go sensor pipeline to a local Node log server.

The app sends only PDR batch diagnostics: sample counts, acceleration summaries, reject reasons, heading state, movement direction, and distance. It does not persist raw sensor sample arrays.

Start the local writer with `npm run sensor-debug-server`. Logs are written under `reports/sensor-debug/<sessionId>/`.

Keep the writer separate from the Expo dev server. Expo may use `8082`; the writer defaults to `8787`. When Expo Go cannot infer the Mac host, start Expo with `EXPO_PUBLIC_SENSOR_DEBUG_LOG_URL=http://<mac-lan-ip>:8787 npm run start` or `npm run start:sensor-debug -- --port 8082`.

Run the writer and Expo in separate terminals, and restart Expo after changing the debug URL because Expo embeds `EXPO_PUBLIC_*` values in the JS bundle.
