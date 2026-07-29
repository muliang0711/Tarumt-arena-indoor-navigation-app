enum ActorDirection {
  down('down'),
  left('left'),
  right('right'),
  up('up');

  const ActorDirection(this.wireValue);
  final String wireValue;
}

final class ViewConeGeometry {
  const ViewConeGeometry({required this.path, required this.size});

  final String path;
  final double size;
}

final class ActorDefinition {
  ActorDefinition({
    required this.displayHeight,
    required this.displayWidth,
    required this.frameDurationMs,
    required Map<ActorDirection, String> idle,
    required this.movementIdleDelayMs,
    required Map<ActorDirection, List<String>> walking,
  }) : idle = Map.unmodifiable(idle),
       walking = Map.unmodifiable(
         walking.map(
           (direction, frames) =>
               MapEntry(direction, List<String>.unmodifiable(frames)),
         ),
       );

  final double displayHeight;
  final double displayWidth;
  final int frameDurationMs;
  final Map<ActorDirection, String> idle;
  final int movementIdleDelayMs;
  final Map<ActorDirection, List<String>> walking;
}
