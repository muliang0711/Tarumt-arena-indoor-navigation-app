import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/ui/map/actor/bob_actor.dart';
import 'package:indoor_navigation/ui/map/models/actor_direction_model.dart';
import 'package:indoor_navigation/ui/map/models/actor_models.dart';

final class ActorSprite extends StatefulWidget {
  const ActorSprite({
    this.actor,
    required this.facingHeadingDegrees,
    this.forceIdle = false,
    required this.position,
    super.key,
  });

  final ActorDefinition? actor;
  final double facingHeadingDegrees;
  final bool forceIdle;
  final RoutePosition position;

  @override
  State<ActorSprite> createState() => _ActorSpriteState();
}

final class _ActorSpriteState extends State<ActorSprite> {
  late ActorDirection _direction;
  int _frameIndex = 0;
  Timer? _frameTimer;
  Timer? _idleTimer;
  bool _isWalking = false;
  late Offset _previousPosition;

  ActorDefinition get _actor => widget.actor ?? bobActor;

  @override
  void initState() {
    super.initState();
    _direction = actorDirectionFromHeading(widget.facingHeadingDegrees);
    _previousPosition = Offset(
      widget.position.screenX,
      widget.position.screenY,
    );
  }

  @override
  void didUpdateWidget(covariant ActorSprite oldWidget) {
    super.didUpdateWidget(oldWidget);
    _direction = actorDirectionWithHysteresis(
      currentDirection: _direction,
      headingDegrees: widget.facingHeadingDegrees,
    );

    final nextPosition = Offset(
      widget.position.screenX,
      widget.position.screenY,
    );
    final moved = (nextPosition - _previousPosition).distance > 0.25;
    if (widget.forceIdle) {
      _frameTimer?.cancel();
      _idleTimer?.cancel();
      _frameTimer = null;
      _idleTimer = null;
      _isWalking = false;
      _frameIndex = 0;
      _previousPosition = nextPosition;
    } else if (moved) {
      _previousPosition = nextPosition;
      _startWalking();
    }
    if (_isWalking &&
        (oldWidget.actor?.frameDurationMs != widget.actor?.frameDurationMs ||
            oldWidget.actor?.walking[_direction]?.length !=
                widget.actor?.walking[_direction]?.length)) {
      _restartFrameTimer();
    }
  }

  void _startWalking() {
    _isWalking = true;
    _idleTimer?.cancel();
    _idleTimer = Timer(Duration(milliseconds: _actor.movementIdleDelayMs), () {
      if (!mounted) {
        return;
      }
      setState(() {
        _isWalking = false;
        _frameIndex = 0;
      });
      _frameTimer?.cancel();
      _frameTimer = null;
      _idleTimer = null;
    });
    if (_frameTimer == null) {
      _restartFrameTimer();
    }
  }

  void _restartFrameTimer() {
    _frameTimer?.cancel();
    _frameTimer = Timer.periodic(
      Duration(milliseconds: _actor.frameDurationMs),
      (_) {
        if (!mounted || !_isWalking) {
          return;
        }
        final frameCount = math.max(1, _actor.walking[_direction]?.length ?? 0);
        setState(() {
          _frameIndex = (_frameIndex + 1) % frameCount;
        });
      },
    );
  }

  @override
  void dispose() {
    _frameTimer?.cancel();
    _idleTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final actor = _actor;
    final walkingFrames = actor.walking[_direction] ?? const <String>[];
    final idleAsset = actor.idle[_direction]!;
    final asset = !widget.forceIdle && _isWalking && walkingFrames.isNotEmpty
        ? walkingFrames[_frameIndex % walkingFrames.length]
        : idleAsset;
    return SizedBox(
      height: actor.displayHeight,
      width: actor.displayWidth,
      child: Image.asset(
        asset,
        fit: BoxFit.fill,
        gaplessPlayback: true,
        key: ValueKey(asset),
      ),
    );
  }
}
