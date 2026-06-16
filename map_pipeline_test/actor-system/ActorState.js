export class ActorState {
  constructor(actors = []) {
    this.actors = actors;
  }

  setActors(actors) {
    this.actors = Array.isArray(actors) ? actors : [];
  }

  getVisibleActors(enabled = false) {
    return enabled ? this.actors : [];
  }
}
