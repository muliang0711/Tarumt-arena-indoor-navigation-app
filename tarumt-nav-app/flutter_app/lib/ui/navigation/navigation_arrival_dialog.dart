import 'package:flutter/material.dart';
import 'package:indoor_navigation/domain/campus/campus_floor.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

abstract final class NavigationArrivalDialogKeys {
  static const overlay = ValueKey<String>('navigation-arrival.overlay');
  static const card = ValueKey<String>('navigation-arrival.card');
  static const confirm = ValueKey<String>('navigation-arrival.confirm');
}

final class NavigationArrivalDialog extends StatelessWidget {
  const NavigationArrivalDialog({
    required this.floor,
    required this.onConfirm,
    required this.room,
    super.key,
  });

  final CampusFloor floor;
  final VoidCallback? onConfirm;
  final CampusRoom room;

  @override
  Widget build(BuildContext context) {
    return Stack(
      key: NavigationArrivalDialogKeys.overlay,
      fit: StackFit.expand,
      children: [
        const ModalBarrier(color: Color(0x990F172A), dismissible: false),
        SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 360),
                child: Material(
                  key: NavigationArrivalDialogKeys.card,
                  color: CampusNavigatorColors.card,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(24),
                    side: const BorderSide(
                      color: CampusNavigatorColors.border,
                      width: 2,
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          height: 76,
                          width: 76,
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFE9D6),
                            border: Border.all(
                              color: CampusNavigatorColors.accentBright,
                              width: 2,
                            ),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.location_on_rounded,
                            color: CampusNavigatorColors.accentBright,
                            size: 42,
                          ),
                        ),
                        const SizedBox(height: 20),
                        const Text(
                          'Destination Reached',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: CampusNavigatorColors.text,
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'You have arrived at ${room.name}.',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: CampusNavigatorColors.textMuted,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            height: 1.35,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8EEE7),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            '${floor.name} · ${room.roomCode}',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: CampusNavigatorColors.accent,
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),
                        SizedBox(
                          width: double.infinity,
                          height: 54,
                          child: FilledButton.icon(
                            key: NavigationArrivalDialogKeys.confirm,
                            onPressed: onConfirm,
                            style: FilledButton.styleFrom(
                              backgroundColor:
                                  CampusNavigatorColors.accentBright,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            icon: const Icon(Icons.home_rounded),
                            label: const Text(
                              'Back to Home',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
