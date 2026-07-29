import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_pdr_fusion_engine.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/ui/map/actor/actor_sprite.dart';
import 'package:indoor_navigation/ui/map/actor/bob_actor.dart';
import 'package:indoor_navigation/ui/map/actor/user_view_cone.dart';
import 'package:indoor_navigation/ui/map/models/actor_models.dart';
import 'package:indoor_navigation/ui/map/models/view_heading_model.dart';
import 'package:indoor_navigation/ui/map/widgets/animated_map_marker.dart';

final class UserPresenceMarker extends StatefulWidget {
  const UserPresenceMarker({
    this.actor,
    this.observedHeadingDegrees,
    required this.position,
    this.wifiCorrection,
    super.key,
  });

  final ActorDefinition? actor;
  final double? observedHeadingDegrees;
  final RoutePosition position;
  final WifiCorrectionVisualState? wifiCorrection;

  @override
  State<UserPresenceMarker> createState() => _UserPresenceMarkerState();
}

final class _UserPresenceMarkerState extends State<UserPresenceMarker> {
  late double _lastObservedHeadingDegrees;

  @override
  void initState() {
    super.initState();
    _lastObservedHeadingDegrees = widget.observedHeadingDegrees ?? 0;
  }

  @override
  void didUpdateWidget(covariant UserPresenceMarker oldWidget) {
    super.didUpdateWidget(oldWidget);
    final observedHeading = widget.observedHeadingDegrees;
    if (observedHeading != null) {
      _lastObservedHeadingDegrees = observedHeading;
    }
  }

  @override
  Widget build(BuildContext context) {
    final definition = widget.actor ?? bobActor;
    final observedHeading = widget.observedHeadingDegrees;
    final facingHeading = resolveUserFacingHeadingDegrees(
      lastObservedHeadingDegrees: _lastObservedHeadingDegrees,
      observedHeadingDegrees: observedHeading,
    );
    const coneLength = 96.0;
    final correction = widget.wifiCorrection;
    final isTeleport = correction?.kind == WifiCorrectionKind.teleport;
    return AnimatedMapMarker(
      anchorX: definition.displayWidth / 2,
      anchorY: definition.displayHeight,
      headingDegrees: 0,
      rotateWithHeading: false,
      screenX: widget.position.screenX,
      screenY: widget.position.screenY,
      key: isTeleport
          ? ValueKey('wifi-teleport-${correction!.sequence}')
          : const ValueKey('user-presence-marker'),
      child: SizedBox(
        height: definition.displayHeight,
        width: definition.displayWidth,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            if (correction != null)
              Positioned.fill(
                child: _WifiCorrectionPulse(
                  key: ValueKey('wifi-pulse-${correction.sequence}'),
                  teleport: isTeleport,
                ),
              ),
            if (observedHeading != null)
              Positioned(
                left: definition.displayWidth / 2 - coneLength,
                top: definition.displayHeight - coneLength,
                child: UserViewCone(headingDegrees: observedHeading),
              ),
            ActorSprite(
              actor: definition,
              facingHeadingDegrees: facingHeading,
              forceIdle: correction != null,
              position: widget.position,
            ),
          ],
        ),
      ),
    );
  }
}

final class _WifiCorrectionPulse extends StatelessWidget {
  const _WifiCorrectionPulse({required this.teleport, super.key});

  final bool teleport;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      duration: Duration(milliseconds: teleport ? 520 : 320),
      tween: Tween(begin: 0, end: 1),
      builder: (context, progress, child) {
        final scale = 0.65 + progress * 1.25;
        return Center(
          child: Transform.scale(
            scale: scale,
            child: Opacity(
              opacity: (1 - progress).clamp(0, 1),
              child: Container(
                height: 44,
                width: 44,
                decoration: BoxDecoration(
                  border: Border.all(
                    color: const Color(0xFF2F80ED),
                    width: teleport ? 4 : 2,
                  ),
                  shape: BoxShape.circle,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
