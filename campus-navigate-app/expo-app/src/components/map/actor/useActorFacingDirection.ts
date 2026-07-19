import { useEffect, useState } from 'react';

import {
  actorDirectionFromHeading,
  actorDirectionWithHysteresis,
} from './actorDirectionModel';

export function useActorFacingDirection(headingDegrees: number) {
  const [direction, setDirection] = useState(() =>
    actorDirectionFromHeading(headingDegrees),
  );

  useEffect(() => {
    setDirection((currentDirection) =>
      actorDirectionWithHysteresis({
        currentDirection,
        headingDegrees,
      }),
    );
  }, [headingDegrees]);

  return direction;
}
