export { ActorLayer } from './ActorLayer';
export {
  buildBobActorAtNode,
  deriveActorMotionState,
  routeNodeToPixels,
} from './actorModel';
export {
  shouldContinueActorSmoothing,
  stepActorRenderPosition,
} from './actorRenderSmoothing';
export {
  normalizeHeading,
  shortestHeadingDelta,
  stepHeadingToward,
} from './actorHeadingSmoothing';
export {
  appendActorMovementTargets,
  consumeActorMovementTarget,
  createActorMovementQueue,
} from './actorMovementQueue';
export type { Actor, ActorDirection } from './actorModel';
export type {
  ActorMovementQueue,
  ActorMovementTarget,
  ActorMovementTiming,
} from './actorMovementQueue';
