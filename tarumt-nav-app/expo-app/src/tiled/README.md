# Tiled

Owns conversion from the Tiled JSON export into app-ready map data.

- `type/` contains small type files and a barrel export.
- `model/` contains pure map, overlay, route, marker, and PNG model functions.
- React components should consume prepared model data instead of parsing TMJ objects directly.

Route turn gating separates heading tolerance from progress. The app may accept the next segment heading while approaching a junction, but constrained blue-marker progress only switches segments inside the tighter turn capture zone.
