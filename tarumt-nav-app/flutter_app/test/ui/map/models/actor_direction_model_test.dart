import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/ui/map/models/actor_direction_model.dart';
import 'package:indoor_navigation/ui/map/models/actor_models.dart';

void main() {
  test('maps the map heading convention to four upright actor directions', () {
    expect(actorDirectionFromHeading(0), ActorDirection.right);
    expect(actorDirectionFromHeading(44), ActorDirection.right);
    expect(actorDirectionFromHeading(45), ActorDirection.down);
    expect(actorDirectionFromHeading(90), ActorDirection.down);
    expect(actorDirectionFromHeading(135), ActorDirection.left);
    expect(actorDirectionFromHeading(180), ActorDirection.left);
    expect(actorDirectionFromHeading(225), ActorDirection.up);
    expect(actorDirectionFromHeading(270), ActorDirection.up);
    expect(actorDirectionFromHeading(315), ActorDirection.right);
  });

  test('normalizes negative and wrapped headings', () {
    expect(actorDirectionFromHeading(-90), ActorDirection.up);
    expect(actorDirectionFromHeading(-180), ActorDirection.left);
    expect(actorDirectionFromHeading(450), ActorDirection.down);
  });

  test('holds direction inside the exact ten-degree boundary buffer', () {
    expect(
      actorDirectionWithHysteresis(
        currentDirection: ActorDirection.right,
        headingDegrees: 54,
      ),
      ActorDirection.right,
    );
    expect(
      actorDirectionWithHysteresis(
        currentDirection: ActorDirection.right,
        headingDegrees: 56,
      ),
      ActorDirection.down,
    );
    expect(
      actorDirectionWithHysteresis(
        currentDirection: ActorDirection.down,
        headingDegrees: 36,
      ),
      ActorDirection.down,
    );
    expect(
      actorDirectionWithHysteresis(
        currentDirection: ActorDirection.down,
        headingDegrees: 34,
      ),
      ActorDirection.right,
    );
  });
}
