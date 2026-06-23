import type { NavigationAction } from './guidanceTypes';

export function normalizeAngleRadians(angle: number): number {
  let normalized = angle;
  while (normalized <= -Math.PI) {
    normalized += Math.PI * 2;
  }
  while (normalized > Math.PI) {
    normalized -= Math.PI * 2;
  }
  return normalized;
}

export function shortestAngleDeltaRadians(target: number, source: number): number {
  return normalizeAngleRadians(target - source);
}

export function classifyNavigationAction(deltaRadians: number): NavigationAction {
  const deltaDegrees = Math.abs((deltaRadians * 180) / Math.PI);
  if (deltaDegrees >= 150) {
    return 'u_turn';
  }
  if (deltaDegrees >= 110) {
    return deltaRadians > 0 ? 'sharp_right' : 'sharp_left';
  }
  if (deltaDegrees >= 45) {
    return deltaRadians > 0 ? 'right' : 'left';
  }
  if (deltaDegrees >= 15) {
    return deltaRadians > 0 ? 'slight_right' : 'slight_left';
  }
  return 'straight';
}

export function actionLabel(action: NavigationAction): string {
  switch (action) {
    case 'slight_left':
      return 'Bear left';
    case 'left':
      return 'Turn left';
    case 'sharp_left':
      return 'Take a sharp left';
    case 'slight_right':
      return 'Bear right';
    case 'right':
      return 'Turn right';
    case 'sharp_right':
      return 'Take a sharp right';
    case 'u_turn':
      return 'Make a U-turn';
    case 'arrived':
      return 'You have arrived';
    default:
      return 'Go straight';
  }
}
