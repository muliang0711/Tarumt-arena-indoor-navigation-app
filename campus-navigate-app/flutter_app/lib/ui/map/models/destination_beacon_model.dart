import 'package:indoor_navigation/domain/simulation/simulation_models.dart';

enum DestinationBeaconPhase { far, near, arrived }

const destinationBeaconNearDistancePixels = 180.0;

DestinationBeaconPhase resolveDestinationBeaconPhase({
  required double distanceRemainingPixels,
  required SimulationStatus status,
}) {
  if (status == SimulationStatus.arrived || distanceRemainingPixels <= 0) {
    return DestinationBeaconPhase.arrived;
  }
  if (distanceRemainingPixels <= destinationBeaconNearDistancePixels) {
    return DestinationBeaconPhase.near;
  }
  return DestinationBeaconPhase.far;
}

Duration destinationBeaconPulseDuration(DestinationBeaconPhase phase) {
  return switch (phase) {
    DestinationBeaconPhase.far => const Duration(milliseconds: 1400),
    DestinationBeaconPhase.near => const Duration(milliseconds: 680),
    DestinationBeaconPhase.arrived => const Duration(milliseconds: 900),
  };
}
