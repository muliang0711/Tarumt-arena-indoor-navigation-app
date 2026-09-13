import 'package:indoor_navigation/domain/journey/journey.dart';

final class JourneyCommandRejected implements Exception {
  const JourneyCommandRejected({required this.code, required this.retryable});
  final String code;
  final bool retryable;

  @override
  String toString() => 'JourneyCommandRejected($code, retryable: $retryable)';
}

abstract interface class JourneyLifecycleGateway {
  bool get isJourneyTransportConnected;

  Future<JourneyAcknowledgement> sendJourneyCommand(JourneyCommand command);
}
