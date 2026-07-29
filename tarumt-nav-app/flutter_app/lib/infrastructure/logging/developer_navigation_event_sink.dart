import 'dart:convert';
import 'dart:developer' as developer;

import 'package:indoor_navigation/application/ports/logging/navigation_event_sink.dart';

final class DeveloperNavigationEventSink implements NavigationEventSink {
  const DeveloperNavigationEventSink();

  @override
  void record(NavigationEvent event) {
    developer.log(
      jsonEncode({
        'destinationId': event.destinationId,
        'destinationNodeId': event.destinationNodeId,
        'details': event.details,
        'timestampMs': event.timestampMs,
        'type': event.type.wireValue,
      }),
      name: 'indoor_navigation.navigation',
    );
  }
}
