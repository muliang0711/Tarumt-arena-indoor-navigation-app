import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/simulation/simulation_models.dart';
import 'package:indoor_navigation/ui/map/models/destination_beacon_model.dart';

void main() {
  test('resolves far, near, and arrived phases at exact boundaries', () {
    expect(
      resolveDestinationBeaconPhase(
        distanceRemainingPixels: destinationBeaconNearDistancePixels + 0.01,
        status: SimulationStatus.moving,
      ),
      DestinationBeaconPhase.far,
    );
    expect(
      resolveDestinationBeaconPhase(
        distanceRemainingPixels: destinationBeaconNearDistancePixels,
        status: SimulationStatus.moving,
      ),
      DestinationBeaconPhase.near,
    );
    expect(
      resolveDestinationBeaconPhase(
        distanceRemainingPixels: 10,
        status: SimulationStatus.arrived,
      ),
      DestinationBeaconPhase.arrived,
    );
    expect(
      resolveDestinationBeaconPhase(
        distanceRemainingPixels: 0,
        status: SimulationStatus.paused,
      ),
      DestinationBeaconPhase.arrived,
    );
  });

  test('near phase pulses faster than the far phase', () {
    expect(
      destinationBeaconPulseDuration(DestinationBeaconPhase.near),
      lessThan(destinationBeaconPulseDuration(DestinationBeaconPhase.far)),
    );
  });
}
