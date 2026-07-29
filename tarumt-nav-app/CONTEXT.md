# Campus Navigation

This context describes anonymous indoor navigation journeys, their planned
routes, observed movement, and outcomes.

## Language

**Journey**:
One anonymous navigation attempt toward one destination. Changing destination
ends the current Journey and starts another.
_Avoid_: Session, trip, navigation session

**Active Journey**:
A Journey that has started and has not reached a terminal Outcome. One
anonymous installation may have at most one Active Journey.
_Avoid_: Open session, current route

**Canonical Journey ID**:
The server-assigned identity of a Journey, shared by lifecycle events and
position observations.
_Avoid_: Client journey ID, session ID

**Planned Route**:
The ordered canonical map edges currently recommended from the Journey origin
to its destination.
_Avoid_: Expected movement, actual route

**Route Revision**:
One validated version of a Journey's Planned Route. A reroute creates the next
Route Revision without creating a new Journey when the destination is
unchanged.
_Avoid_: Route update, route diff

**Position Observation**:
A client-produced statement that a Journey is at a progress value on a
particular edge. It does not prove that the edge was completed.
_Avoid_: Traversal, location fact

**Journey Lifecycle Event**:
An immutable fact that a Journey started, received a new Route Revision, or
ended.
_Avoid_: Position update, presence event

**Journey Outcome**:
The terminal classification of a Journey: arrived, cancelled, superseded, or
expired. Arrived means the client navigation engine declared arrival, not that
the server independently verified physical arrival.
_Avoid_: Status, result

**Edge Traversal**:
A server-derived fact that a Journey entered and later exited one canonical
edge.
_Avoid_: Position Observation, traversal event count

**Observed Route**:
The ordered canonical edges inferred from a Journey's Position Observations.
_Avoid_: Planned Route, selected route

**Map Revision**:
An immutable content-identified version of a canonical Map Graph used to
interpret node and edge identities.
_Avoid_: Schema version, client map version

**Map Graph**:
The canonical set of buildings, floors, nodes, edges, and cross-floor
connectors against which routes are validated.
_Avoid_: Floor image, Tiled map
