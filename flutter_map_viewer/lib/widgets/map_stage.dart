import 'dart:ui' as ui;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../models/map_project.dart';

class MapStage extends StatefulWidget {
  const MapStage({
    super.key,
    required this.project,
    required this.overlayImageProvider,
    required this.resolveAssetImageProvider,
    required this.assetImages,
    required this.route,
    required this.startNodeId,
    required this.endNodeId,
    required this.playerTile,
    required this.onNodeTap,
  });

  final MapProject project;
  final ImageProvider<Object>? overlayImageProvider;
  final ImageProvider<Object>? Function(String assetId) resolveAssetImageProvider;
  final Map<String, ui.Image> assetImages;
  final RouteResult route;
  final String? startNodeId;
  final String? endNodeId;
  final Offset? playerTile;
  final ValueChanged<String> onNodeTap;

  @override
  State<MapStage> createState() => _MapStageState();
}

class _MapStageState extends State<MapStage> {
  final TransformationController _controller = TransformationController();
  Size _viewportSize = Size.zero;
  String _lastViewportKey = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _frameContent());
  }

  @override
  void didUpdateWidget(covariant MapStage oldWidget) {
    super.didUpdateWidget(oldWidget);
    final routeChanged = oldWidget.route.nodes != widget.route.nodes;
    final projectChanged = oldWidget.project != widget.project;
    if (routeChanged || projectChanged) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _frameContent());
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _frameContent() {
    if (!mounted || _viewportSize.isEmpty) {
      return;
    }

    final childWidth = widget.project.pixelWidth;
    final childHeight = widget.project.pixelHeight;
    final fitScale = math.min(_viewportSize.width / childWidth, _viewportSize.height / childHeight);
    final scale = widget.route.hasRoute
        ? math.max(math.min(fitScale * 2.1, 4.0), fitScale)
        : fitScale;

    final focusRect = widget.route.hasRoute
        ? widget.project.routeBounds(widget.route.nodes)
        : widget.playerTile != null
            ? Rect.fromCenter(
                center: Offset(
                  (widget.playerTile!.dx + 0.5) * widget.project.tileSize,
                  (widget.playerTile!.dy + 0.5) * widget.project.tileSize,
                ),
                width: widget.project.tileSize * 8,
                height: widget.project.tileSize * 6,
              )
            : Rect.fromLTWH(0, 0, childWidth, childHeight);

    final centerX = focusRect.center.dx;
    final centerY = widget.route.hasRoute
        ? focusRect.top + (focusRect.height * 0.62)
        : focusRect.center.dy;

    final dx = (_viewportSize.width * 0.5) - (centerX * scale);
    final dy = (_viewportSize.height * 0.58) - (centerY * scale);
    _controller.value = Matrix4.identity()
      ..translateByDouble(dx, dy, 0, 1)
      ..scaleByDouble(scale, scale, 1, 1);
  }

  void _handleTap(TapUpDetails details) {
    final scenePoint = _controller.toScene(details.localPosition);
    final node = _findClosestNode(scenePoint);
    if (node != null) {
      widget.onNodeTap(node.id);
    }
  }

  MapNode? _findClosestNode(Offset point) {
    MapNode? bestNode;
    var bestDistance = double.infinity;
    final hitRadius = math.max(widget.project.tileSize * 0.75, 16.0);

    for (final node in widget.project.nodes) {
      final center = widget.project.nodeCenter(node);
      final distance = (center - point).distance;
      if (distance <= hitRadius && distance < bestDistance) {
        bestDistance = distance;
        bestNode = node;
      }
    }
    return bestNode;
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final nextViewport = Size(constraints.maxWidth, constraints.maxHeight);
        final nextViewportKey =
            '${nextViewport.width.toStringAsFixed(2)}:${nextViewport.height.toStringAsFixed(2)}';
        if (_lastViewportKey != nextViewportKey) {
          _lastViewportKey = nextViewportKey;
          _viewportSize = nextViewport;
          WidgetsBinding.instance.addPostFrameCallback((_) => _frameContent());
        }

        return ClipRRect(
          borderRadius: BorderRadius.circular(28),
          child: DecoratedBox(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0xFFF3D9D0),
                  Color(0xFFE0C2B8),
                ],
              ),
            ),
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTapUp: _handleTap,
              child: Stack(
                children: [
                  InteractiveViewer(
                    transformationController: _controller,
                    boundaryMargin: const EdgeInsets.all(320),
                    minScale: 0.25,
                    maxScale: 6,
                    child: SizedBox(
                      width: widget.project.pixelWidth,
                      height: widget.project.pixelHeight,
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          _StageImage(
                            project: widget.project,
                            overlayImageProvider: widget.overlayImageProvider,
                            resolveAssetImageProvider: widget.resolveAssetImageProvider,
                            assetImages: widget.assetImages,
                          ),
                          CustomPaint(
                            painter: _MapOverlayPainter(
                              project: widget.project,
                              route: widget.route,
                              startNodeId: widget.startNodeId,
                              endNodeId: widget.endNodeId,
                              playerTile: widget.playerTile,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  _TopNavigationCard(
                    route: widget.route,
                    destination: widget.project.nodeById(widget.endNodeId),
                  ),
                  _BottomNavigationBar(
                    start: widget.project.nodeById(widget.startNodeId),
                    destination: widget.project.nodeById(widget.endNodeId),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _StageImage extends StatelessWidget {
  const _StageImage({
    required this.project,
    required this.overlayImageProvider,
    required this.resolveAssetImageProvider,
    required this.assetImages,
  });

  final MapProject project;
  final ImageProvider<Object>? overlayImageProvider;
  final ImageProvider<Object>? Function(String assetId) resolveAssetImageProvider;
  final Map<String, ui.Image> assetImages;

  @override
  Widget build(BuildContext context) {
    if (overlayImageProvider != null) {
      return DecoratedBox(
        decoration: BoxDecoration(
          image: DecorationImage(
            image: overlayImageProvider!,
            fit: BoxFit.fill,
          ),
        ),
      );
    }

    if (project.placements.isNotEmpty) {
      return _TilemapScene(
        project: project,
        assetImages: assetImages,
      );
    }

    return CustomPaint(
      painter: _FallbackGridPainter(project: project),
    );
  }
}

class _TilemapScene extends StatelessWidget {
  const _TilemapScene({
    required this.project,
    required this.assetImages,
  });

  final MapProject project;
  final Map<String, ui.Image> assetImages;

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: CustomPaint(
        painter: _TilemapScenePainter(
          project: project,
          assetImages: assetImages,
        ),
      ),
    );
  }
}

class _TilemapScenePainter extends CustomPainter {
  const _TilemapScenePainter({
    required this.project,
    required this.assetImages,
  });

  final MapProject project;
  final Map<String, ui.Image> assetImages;

  @override
  void paint(Canvas canvas, Size size) {
    final walkableImage = assetImages[project.background.walkableAssetId];
    final blockedImage = assetImages[project.background.blockedAssetId];

    for (var y = 0; y < project.mapHeight; y += 1) {
      for (var x = 0; x < project.mapWidth; x += 1) {
        final kind = project.tileKindAt(x, y);
        final image = kind == 'blocked' ? blockedImage : walkableImage;
        final destination = Rect.fromLTWH(
          x * project.tileSize.toDouble(),
          y * project.tileSize.toDouble(),
          project.tileSize.toDouble(),
          project.tileSize.toDouble(),
        );

        if (image != null) {
          canvas.drawImageRect(
            image,
            Rect.fromLTWH(0, 0, image.width.toDouble(), image.height.toDouble()),
            destination,
            Paint()..filterQuality = FilterQuality.none,
          );
        } else {
          canvas.drawRect(
            destination,
            Paint()
              ..color = kind == 'blocked'
                  ? const Color(0xFF85716A)
                  : const Color(0xFFDDBFB2),
          );
        }
      }
    }

    for (final placement in project.placements) {
      final image = assetImages[placement.assetId];
      if (image == null) {
        continue;
      }
      final destination = Rect.fromLTWH(
        placement.tileX * project.tileSize,
        placement.tileY * project.tileSize,
        image.width.toDouble(),
        image.height.toDouble(),
      );
      canvas.drawImageRect(
        image,
        Rect.fromLTWH(0, 0, image.width.toDouble(), image.height.toDouble()),
        destination,
        Paint()..filterQuality = FilterQuality.none,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _TilemapScenePainter oldDelegate) {
    return oldDelegate.project != project || oldDelegate.assetImages != assetImages;
  }
}

class _TopNavigationCard extends StatelessWidget {
  const _TopNavigationCard({
    required this.route,
    required this.destination,
  });

  final RouteResult route;
  final MapNode? destination;

  @override
  Widget build(BuildContext context) {
    if (!route.hasRoute || destination == null) {
      return const SizedBox.shrink();
    }

    return Positioned(
      top: 16,
      left: 16,
      right: 16,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: const Color(0xFF19161B).withValues(alpha: 0.92),
          borderRadius: BorderRadius.circular(22),
          boxShadow: const [
            BoxShadow(
              color: Color(0x33000000),
              blurRadius: 22,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFB45A),
                  borderRadius: BorderRadius.circular(14),
                ),
                alignment: Alignment.center,
                child: const Icon(Icons.turn_right_rounded, color: Color(0xFF201A12)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '${route.segmentCount} segments ahead',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Heading to ${destination!.label}',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: const Color(0xFFDCC8C1),
                          ),
                    ),
                  ],
                ),
              ),
              Text(
                '${route.tileDistance.toStringAsFixed(1)}t',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: const Color(0xFFFFD49D),
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BottomNavigationBar extends StatelessWidget {
  const _BottomNavigationBar({
    required this.start,
    required this.destination,
  });

  final MapNode? start;
  final MapNode? destination;

  @override
  Widget build(BuildContext context) {
    if (start == null && destination == null) {
      return Positioned(
        left: 16,
        right: 16,
        bottom: 16,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: const Color(0xF8F7E8E0),
            borderRadius: BorderRadius.circular(22),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Text(
              'Tap one node for start, then another node for destination.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF4C3B35),
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
        ),
      );
    }

    return Positioned(
      left: 16,
      right: 16,
      bottom: 16,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: const Color(0xFFF7E8E0),
          borderRadius: BorderRadius.circular(22),
          boxShadow: const [
            BoxShadow(
              color: Color(0x24000000),
              blurRadius: 18,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: DefaultTextStyle(
            style: Theme.of(context).textTheme.bodyMedium!.copyWith(
                  color: const Color(0xFF4B3935),
                  fontWeight: FontWeight.w600,
                ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (start != null) Text('Start: ${start!.label}'),
                if (destination != null) Text('Destination: ${destination!.label}'),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _FallbackGridPainter extends CustomPainter {
  const _FallbackGridPainter({
    required this.project,
  });

  final MapProject project;

  @override
  void paint(Canvas canvas, Size size) {
    final backgroundPaint = Paint()..color = const Color(0xFFE7C8BF);
    canvas.drawRect(Offset.zero & size, backgroundPaint);

    final tilePaint = Paint()..color = const Color(0x26FFFFFF);
    for (var y = 0; y < project.mapHeight; y += 1) {
      for (var x = 0; x < project.mapWidth; x += 1) {
        if ((x + y).isEven) {
          canvas.drawRect(
            Rect.fromLTWH(
              x * project.tileSize.toDouble(),
              y * project.tileSize.toDouble(),
              project.tileSize.toDouble(),
              project.tileSize.toDouble(),
            ),
            tilePaint,
          );
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant _FallbackGridPainter oldDelegate) {
    return oldDelegate.project != project;
  }
}

class _MapOverlayPainter extends CustomPainter {
  const _MapOverlayPainter({
    required this.project,
    required this.route,
    required this.startNodeId,
    required this.endNodeId,
    required this.playerTile,
  });

  final MapProject project;
  final RouteResult route;
  final String? startNodeId;
  final String? endNodeId;
  final Offset? playerTile;

  @override
  void paint(Canvas canvas, Size size) {
    if (route.hasRoute) {
      canvas.drawRect(
        Offset.zero & size,
        Paint()..color = const Color(0x660F1013),
      );
    }

    for (final tile in project.resolvedTiles) {
      final color = tile.kind == 'walkable'
          ? const Color(0x1A5AD68C)
          : const Color(0x263D4550);
      canvas.drawRect(
        Rect.fromLTWH(
          tile.x * project.tileSize.toDouble(),
          tile.y * project.tileSize.toDouble(),
          project.tileSize.toDouble(),
          project.tileSize.toDouble(),
        ),
        Paint()..color = color,
      );
    }

    if (route.nodes.length >= 2) {
      final glow = Path();
      final routePath = Path();
      for (var index = 0; index < route.nodes.length; index += 1) {
        final point = project.nodeCenter(route.nodes[index]);
        if (index == 0) {
          glow.moveTo(point.dx, point.dy);
          routePath.moveTo(point.dx, point.dy);
        } else {
          glow.lineTo(point.dx, point.dy);
          routePath.lineTo(point.dx, point.dy);
        }
      }
      canvas.drawPath(
        glow,
        Paint()
          ..color = const Color(0xB0FFDB9A)
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..strokeWidth = 18,
      );
      canvas.drawPath(
        routePath,
        Paint()
          ..color = const Color(0xFFFF8D4C)
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..strokeWidth = 8,
      );
    }

    for (final link in project.links) {
      final from = project.nodeById(link.from);
      final to = project.nodeById(link.to);
      if (from == null || to == null) {
        continue;
      }
      canvas.drawLine(
        project.nodeCenter(from),
        project.nodeCenter(to),
        Paint()
          ..color = const Color(0x38F7F1ED)
          ..strokeWidth = 2,
      );
    }

    for (final node in project.nodes) {
      final point = project.nodeCenter(node);
      final isStart = node.id == startNodeId;
      final isEnd = node.id == endNodeId;
      final fillColor = isStart
          ? const Color(0xFF60D17E)
          : isEnd
              ? const Color(0xFFFFA85B)
              : _nodeTypeColor(node.type);

      canvas.drawCircle(point, 10, Paint()..color = const Color(0xFF201B19));
      canvas.drawCircle(point, 7, Paint()..color = fillColor);

      final textPainter = TextPainter(
        text: TextSpan(
          text: node.label,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 10,
            fontWeight: FontWeight.w700,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout(maxWidth: 90);

      final labelOffset = Offset(
        math.min(point.dx + 10, size.width - textPainter.width - 4),
        math.max(point.dy - 24, 4),
      );

      final labelRect = RRect.fromRectAndRadius(
        Rect.fromLTWH(
          labelOffset.dx - 4,
          labelOffset.dy - 2,
          textPainter.width + 8,
          textPainter.height + 4,
        ),
        const Radius.circular(8),
      );

      canvas.drawRRect(labelRect, Paint()..color = const Color(0xB219161B));
      textPainter.paint(canvas, labelOffset);
    }

    if (playerTile != null) {
      final center = Offset(
        (playerTile!.dx + 0.5) * project.tileSize,
        (playerTile!.dy + 0.5) * project.tileSize,
      );
      canvas.drawCircle(center, 11, Paint()..color = const Color(0xAA171114));
      canvas.drawCircle(center, 8, Paint()..color = const Color(0xFF58B4FF));
      canvas.drawCircle(center.translate(0, -2), 3, Paint()..color = Colors.white);
    }
  }

  static Color _nodeTypeColor(String type) {
    switch (type) {
      case 'junction':
        return const Color(0xFF86C7FF);
      case 'stairs':
        return const Color(0xFFFFE08A);
      case 'elevator':
        return const Color(0xFFF2A9FF);
      default:
        return const Color(0xFFF6E7DC);
    }
  }

  @override
  bool shouldRepaint(covariant _MapOverlayPainter oldDelegate) {
    return oldDelegate.project != project ||
        oldDelegate.route.nodes != route.nodes ||
        oldDelegate.startNodeId != startNodeId ||
        oldDelegate.endNodeId != endNodeId ||
        oldDelegate.playerTile != playerTile;
  }
}
