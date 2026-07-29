import 'package:flutter/material.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/ui/map/actor/actor_sprite.dart';
import 'package:indoor_navigation/ui/map/widgets/animated_map_marker.dart';

const localPresenceActorColor = Color(0xFFDC2626);
const remotePresenceActorColors = <Color>[
  Color(0xFF2563EB),
  Color(0xFF0F766E),
  Color(0xFF7C3AED),
  Color(0xFFD97706),
  Color(0xFF0369A1),
];

Color resolveLivePresenceActorColor(AnonymousPresence presence) {
  if (presence.origin == PresenceOrigin.localSimulation) {
    return localPresenceActorColor;
  }
  return remotePresenceActorColors[presence.visualSeed.abs() %
      remotePresenceActorColors.length];
}

final class LivePresenceActorMarker extends StatelessWidget {
  const LivePresenceActorMarker({
    required this.presence,
    required this.position,
    super.key,
  });

  final AnonymousPresence presence;
  final RoutePosition position;

  @override
  Widget build(BuildContext context) {
    final color = resolveLivePresenceActorColor(presence);
    final opacity = presence.activity == PresenceActivity.idle ? 0.72 : 0.92;
    return AnimatedMapMarker(
      anchorX: 18,
      anchorY: 52,
      headingDegrees: 0,
      rotateWithHeading: false,
      screenX: position.screenX,
      screenY: position.screenY,
      teleportThresholdPixels: 240,
      child: Semantics(
        image: true,
        label: presence.origin == PresenceOrigin.localSimulation
            ? 'Local simulated presence'
            : 'Anonymous live presence',
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 260),
          opacity: opacity,
          child: SizedBox(
            height: 52,
            width: 36,
            child: Stack(
              alignment: Alignment.bottomCenter,
              clipBehavior: Clip.none,
              children: [
                Positioned(
                  bottom: -2,
                  child: Container(
                    height: 13,
                    width: 28,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.18),
                      border: Border.all(color: color, width: 2),
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
                if (presence.activity == PresenceActivity.recentlyJoined)
                  Positioned(
                    bottom: -7,
                    child: TweenAnimationBuilder<double>(
                      duration: const Duration(milliseconds: 900),
                      tween: Tween(begin: 0.65, end: 1.35),
                      builder: (context, scale, child) => Transform.scale(
                        scale: scale,
                        child: Opacity(
                          opacity: (1.35 - scale).clamp(0, 1),
                          child: child,
                        ),
                      ),
                      child: Container(
                        height: 34,
                        width: 34,
                        decoration: BoxDecoration(
                          border: Border.all(color: color, width: 2),
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  ),
                ColorFiltered(
                  colorFilter: ColorFilter.mode(
                    color.withValues(alpha: 0.26),
                    BlendMode.srcATop,
                  ),
                  child: ActorSprite(
                    facingHeadingDegrees: position.headingDegrees,
                    forceIdle: presence.activity == PresenceActivity.idle,
                    position: position,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
