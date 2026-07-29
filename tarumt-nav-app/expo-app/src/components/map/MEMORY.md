# Map Component Memory

- Base map remains a single PNG.
- Marker and overlay positions are already corrected before reaching components.
- Map zoom is applied once to the full map layer; overlay coordinates stay in original map pixels.
- Avoid parsing TMJ objects here.
- Red marker is an arrow rotated by derived estimate heading.
- Red and blue marker jumps should be smoothed with UI animation only; do not change PDR or route-position logic for visual interpolation.
