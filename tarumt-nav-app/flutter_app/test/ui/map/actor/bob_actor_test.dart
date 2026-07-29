import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/ui/map/actor/bob_actor.dart';
import 'package:indoor_navigation/ui/map/models/actor_models.dart';

void main() {
  test('defines the exact Bob timing, dimensions, and 28 copied assets', () {
    expect(bobActor.displayHeight, 48);
    expect(bobActor.displayWidth, 24);
    expect(bobActor.frameDurationMs, 110);
    expect(bobActor.movementIdleDelayMs, 600);
    expect(bobActor.idle.keys, ActorDirection.values);
    for (final frames in bobActor.walking.values) {
      expect(frames, hasLength(6));
    }
    final assets = <String>{
      ...bobActor.idle.values,
      ...bobActor.walking.values.expand((frames) => frames),
    };
    expect(assets, hasLength(28));
    expect(assets.every((asset) => File(asset).existsSync()), isTrue);
  });
}
