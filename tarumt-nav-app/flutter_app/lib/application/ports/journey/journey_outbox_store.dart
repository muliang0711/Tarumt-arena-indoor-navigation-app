import 'package:indoor_navigation/domain/journey/journey.dart';

abstract interface class JourneyOutboxStore {
  Future<JourneyOutboxSnapshot> read();

  Future<void> write(JourneyOutboxSnapshot snapshot);
}
