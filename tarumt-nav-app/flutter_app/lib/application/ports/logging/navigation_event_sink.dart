enum NavigationEventType {
  sessionStarted('session_started'),
  routeChanged('route_changed'),
  sensorStatusChanged('sensor_status_changed'),
  positionUpdated('position_updated'),
  wrongWayDetected('wrong_way_detected'),
  directionRecovered('direction_recovered'),
  arrived('arrived'),
  navigationCompleted('navigation_completed'),
  paused('paused'),
  resumed('resumed'),
  stopped('stopped');

  const NavigationEventType(this.wireValue);

  final String wireValue;
}

final class NavigationEvent {
  NavigationEvent({
    required this.destinationId,
    required this.destinationNodeId,
    Map<String, Object?> details = const {},
    required this.timestampMs,
    required this.type,
  }) : details = Map.unmodifiable(details);

  final String destinationId;
  final String destinationNodeId;
  final Map<String, Object?> details;
  final int timestampMs;
  final NavigationEventType type;
}

abstract interface class NavigationEventSink {
  void record(NavigationEvent event);
}

final class NoopNavigationEventSink implements NavigationEventSink {
  const NoopNavigationEventSink();

  @override
  void record(NavigationEvent event) {}
}
