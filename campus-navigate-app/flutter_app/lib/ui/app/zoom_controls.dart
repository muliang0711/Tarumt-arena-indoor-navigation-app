import 'package:flutter/material.dart';

final class ZoomControls extends StatelessWidget {
  const ZoomControls({
    required this.onZoomIn,
    required this.onZoomOut,
    required this.zoomPercent,
    super.key,
  });

  static const zoomOutButtonKey = ValueKey<String>('zoom-controls.out');
  static const zoomInButtonKey = ValueKey<String>('zoom-controls.in');
  static const zoomValueKey = ValueKey<String>('zoom-controls.value');

  final VoidCallback onZoomIn;
  final VoidCallback onZoomOut;
  final int zoomPercent;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _ZoomButton(
          accessibilityLabel: 'Zoom out',
          glyph: '-',
          key: zoomOutButtonKey,
          onPressed: onZoomOut,
        ),
        const SizedBox(width: 6),
        SizedBox(
          width: 38,
          child: Text(
            '$zoomPercent%',
            key: zoomValueKey,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Color(0xFF17202F),
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(width: 6),
        _ZoomButton(
          accessibilityLabel: 'Zoom in',
          glyph: '+',
          key: zoomInButtonKey,
          onPressed: onZoomIn,
        ),
      ],
    );
  }
}

final class _ZoomButton extends StatelessWidget {
  const _ZoomButton({
    required this.accessibilityLabel,
    required this.glyph,
    required this.onPressed,
    super.key,
  });

  final String accessibilityLabel;
  final String glyph;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      excludeSemantics: true,
      label: accessibilityLabel,
      child: Material(
        color: const Color(0xFF1D4ED8),
        borderRadius: BorderRadius.circular(6),
        child: InkWell(
          borderRadius: BorderRadius.circular(6),
          onTap: onPressed,
          overlayColor: WidgetStateProperty.resolveWith((states) {
            return states.contains(WidgetState.pressed)
                ? const Color(0xFF163FAE)
                : null;
          }),
          child: SizedBox(
            height: 34,
            width: 34,
            child: Center(
              child: Text(
                glyph,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  height: 28 / 24,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
