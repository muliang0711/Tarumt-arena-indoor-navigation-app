import { ImageSourcePropType } from 'react-native';

export type ActorDirection = 'down' | 'left' | 'right' | 'up';
export type ActorAction = 'idle' | 'run';

type BobIdleAssets = Record<ActorDirection, ImageSourcePropType>;
type BobRunAssets = Record<ActorDirection, readonly ImageSourcePropType[]>;

export const bobIdleAssets: BobIdleAssets = {
  down: require('../../storage/bob/bob_stand/idle_down.png'),
  left: require('../../storage/bob/bob_stand/idle_left.png'),
  right: require('../../storage/bob/bob_stand/idle_right.png'),
  up: require('../../storage/bob/bob_stand/idle_up.png'),
};

export const bobRunAssets: BobRunAssets = {
  down: [
    require('../../storage/bob/bob_run/run_down_1.png'),
    require('../../storage/bob/bob_run/run_down_2.png'),
    require('../../storage/bob/bob_run/run_down_3.png'),
    require('../../storage/bob/bob_run/run_down_4.png'),
    require('../../storage/bob/bob_run/run_down_5.png'),
    require('../../storage/bob/bob_run/run_down_6.png'),
  ],
  left: [
    require('../../storage/bob/bob_run/run_left_1.png'),
    require('../../storage/bob/bob_run/run_left_2.png'),
    require('../../storage/bob/bob_run/run_left_3.png'),
    require('../../storage/bob/bob_run/run_left_4.png'),
    require('../../storage/bob/bob_run/run_left_5.png'),
    require('../../storage/bob/bob_run/run_left_6.png'),
  ],
  right: [
    require('../../storage/bob/bob_run/run_right_1.png'),
    require('../../storage/bob/bob_run/run_right_2.png'),
    require('../../storage/bob/bob_run/run_right_3.png'),
    require('../../storage/bob/bob_run/run_right_4.png'),
    require('../../storage/bob/bob_run/run_right_5.png'),
    require('../../storage/bob/bob_run/run_right_6.png'),
  ],
  up: [
    require('../../storage/bob/bob_run/run_up_1.png'),
    require('../../storage/bob/bob_run/run_up_2.png'),
    require('../../storage/bob/bob_run/run_up_3.png'),
    require('../../storage/bob/bob_run/run_up_4.png'),
    require('../../storage/bob/bob_run/run_up_5.png'),
    require('../../storage/bob/bob_run/run_up_6.png'),
  ],
};

export function bobSpriteFrameCount(direction: ActorDirection): number {
  return bobRunAssets[direction].length;
}
