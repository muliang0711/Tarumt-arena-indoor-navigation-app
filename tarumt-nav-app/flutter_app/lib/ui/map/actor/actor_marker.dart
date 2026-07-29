import 'package:flutter/material.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/ui/map/actor/actor_sprite.dart';
import 'package:indoor_navigation/ui/map/actor/bob_actor.dart';
import 'package:indoor_navigation/ui/map/models/actor_models.dart';
import 'package:indoor_navigation/ui/map/widgets/animated_map_marker.dart';

final class ActorMarker extends StatelessWidget {
  const ActorMarker({
    this.actor,
    required this.facingHeadingDegrees,
    required this.position,
    super.key,
  });

  final ActorDefinition? actor;
  final double facingHeadingDegrees;
  final RoutePosition position;

  @override
  Widget build(BuildContext context) {
    final definition = actor ?? bobActor;
    return AnimatedMapMarker(
      anchorX: definition.displayWidth / 2,
      anchorY: definition.displayHeight,
      headingDegrees: 0,
      rotateWithHeading: false,
      screenX: position.screenX,
      screenY: position.screenY,
      child: ActorSprite(
        actor: definition,
        facingHeadingDegrees: facingHeadingDegrees,
        position: position,
      ),
    );
  }
}
