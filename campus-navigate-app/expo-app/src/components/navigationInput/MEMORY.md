# Navigation Input Component Memory

- Replay injects an already-derived debug estimate.
- Start/Stop controls own transient live `DeviceMotion -> PDR` input.
- Red marker can move from derived estimates.
- Blue marker consumes the same derived estimate only after route snapping.
- Blue marker must remain on the fixed route.
- Do not add any raw recording/export controls in this folder.
- Keep phone testing diagnostics readable: use multi-line detail cells instead of packing all debug values into one row.
- Starting raw motion PDR should pause route simulation so field tests are not driven by the simulator.
