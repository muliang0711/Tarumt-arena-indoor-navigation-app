import type { ImageSourcePropType } from 'react-native';

import type { ActorDirection } from './actorDirectionModel';

export type ActorDefinition = {
  displayHeight: number;
  displayWidth: number;
  frameDurationMs: number;
  idle: Record<ActorDirection, ImageSourcePropType>;
  movementIdleDelayMs: number;
  walking: Record<ActorDirection, readonly ImageSourcePropType[]>;
};

export const BOB_ACTOR: ActorDefinition = {
  displayHeight: 48,
  displayWidth: 24,
  frameDurationMs: 110,
  idle: {
    down: require('../../../../assets/actors/bob/bob_stand/idle_down.png'),
    left: require('../../../../assets/actors/bob/bob_stand/idle_left.png'),
    right: require('../../../../assets/actors/bob/bob_stand/idle_right.png'),
    up: require('../../../../assets/actors/bob/bob_stand/idle_up.png'),
  },
  movementIdleDelayMs: 600,
  walking: {
    down: [
      require('../../../../assets/actors/bob/bob_run/run_down_1.png'),
      require('../../../../assets/actors/bob/bob_run/run_down_2.png'),
      require('../../../../assets/actors/bob/bob_run/run_down_3.png'),
      require('../../../../assets/actors/bob/bob_run/run_down_4.png'),
      require('../../../../assets/actors/bob/bob_run/run_down_5.png'),
      require('../../../../assets/actors/bob/bob_run/run_down_6.png'),
    ],
    left: [
      require('../../../../assets/actors/bob/bob_run/run_left_1.png'),
      require('../../../../assets/actors/bob/bob_run/run_left_2.png'),
      require('../../../../assets/actors/bob/bob_run/run_left_3.png'),
      require('../../../../assets/actors/bob/bob_run/run_left_4.png'),
      require('../../../../assets/actors/bob/bob_run/run_left_5.png'),
      require('../../../../assets/actors/bob/bob_run/run_left_6.png'),
    ],
    right: [
      require('../../../../assets/actors/bob/bob_run/run_right_1.png'),
      require('../../../../assets/actors/bob/bob_run/run_right_2.png'),
      require('../../../../assets/actors/bob/bob_run/run_right_3.png'),
      require('../../../../assets/actors/bob/bob_run/run_right_4.png'),
      require('../../../../assets/actors/bob/bob_run/run_right_5.png'),
      require('../../../../assets/actors/bob/bob_run/run_right_6.png'),
    ],
    up: [
      require('../../../../assets/actors/bob/bob_run/run_up_1.png'),
      require('../../../../assets/actors/bob/bob_run/run_up_2.png'),
      require('../../../../assets/actors/bob/bob_run/run_up_3.png'),
      require('../../../../assets/actors/bob/bob_run/run_up_4.png'),
      require('../../../../assets/actors/bob/bob_run/run_up_5.png'),
      require('../../../../assets/actors/bob/bob_run/run_up_6.png'),
    ],
  },
};
