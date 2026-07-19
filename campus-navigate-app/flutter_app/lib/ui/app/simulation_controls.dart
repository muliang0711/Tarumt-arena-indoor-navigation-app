import 'package:flutter/material.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

final class SimulationControls extends StatelessWidget {
  const SimulationControls({
    required this.onPause,
    required this.onReset,
    required this.onStart,
    required this.onStepForward,
    super.key,
  });

  static const startButtonKey = ValueKey<String>('simulation-controls.start');
  static const pauseButtonKey = ValueKey<String>('simulation-controls.pause');
  static const stepButtonKey = ValueKey<String>('simulation-controls.step');
  static const resetButtonKey = ValueKey<String>('simulation-controls.reset');

  final VoidCallback onPause;
  final VoidCallback onReset;
  final VoidCallback onStart;
  final VoidCallback onStepForward;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: IndoorNavigationColors.panel,
        border: Border(
          bottom: BorderSide(color: IndoorNavigationColors.border, width: 0.5),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            Expanded(
              child: _SimulationButton(
                accessibilityLabel: 'Start route simulation',
                key: startButtonKey,
                label: 'Start',
                onPressed: onStart,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _SimulationButton(
                accessibilityLabel: 'Pause route simulation',
                key: pauseButtonKey,
                label: 'Pause',
                onPressed: onPause,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _SimulationButton(
                accessibilityLabel: 'Step route simulation',
                key: stepButtonKey,
                label: 'Step',
                onPressed: onStepForward,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _SimulationButton(
                accessibilityLabel: 'Reset route simulation',
                key: resetButtonKey,
                label: 'Reset',
                onPressed: onReset,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

final class _SimulationButton extends StatelessWidget {
  const _SimulationButton({
    required this.accessibilityLabel,
    required this.label,
    required this.onPressed,
    super.key,
  });

  final String accessibilityLabel;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      excludeSemantics: true,
      label: accessibilityLabel,
      child: Material(
        color: IndoorNavigationColors.slate,
        borderRadius: BorderRadius.circular(6),
        child: InkWell(
          borderRadius: BorderRadius.circular(6),
          onTap: onPressed,
          overlayColor: WidgetStateProperty.resolveWith((states) {
            return states.contains(WidgetState.pressed)
                ? IndoorNavigationColors.slateSoft
                : null;
          }),
          child: SizedBox(
            height: 34,
            child: Center(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
