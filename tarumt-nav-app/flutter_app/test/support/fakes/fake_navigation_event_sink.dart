import 'package:indoor_navigation/application/ports/logging/navigation_event_sink.dart';

final class FakeNavigationEventSink implements NavigationEventSink {
  final List<NavigationEvent> events = [];

  @override
  void record(NavigationEvent event) {
    events.add(event);
  }
}
