import 'package:indoor_navigation/domain/journey/journey.dart';

abstract interface class JourneyLifecycleGateway {
  bool get isJourneyTransportConnected;

  Future<JourneyAcknowledgement> sendJourneyCommand(JourneyCommand command);
}
