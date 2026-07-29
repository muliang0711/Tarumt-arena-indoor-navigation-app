import 'package:indoor_navigation/ui/map/models/actor_models.dart';

final bobActor = ActorDefinition(
  displayHeight: 48,
  displayWidth: 24,
  frameDurationMs: 110,
  idle: const {
    ActorDirection.down: 'assets/actors/bob/bob_stand/idle_down.png',
    ActorDirection.left: 'assets/actors/bob/bob_stand/idle_left.png',
    ActorDirection.right: 'assets/actors/bob/bob_stand/idle_right.png',
    ActorDirection.up: 'assets/actors/bob/bob_stand/idle_up.png',
  },
  movementIdleDelayMs: 600,
  walking: {
    for (final direction in ActorDirection.values)
      direction: <String>[
        for (var frame = 1; frame <= 6; frame += 1)
          'assets/actors/bob/bob_run/run_${direction.wireValue}_$frame.png',
      ],
  },
);
