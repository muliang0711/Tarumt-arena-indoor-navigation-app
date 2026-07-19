import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/view_models/wifi_positioning_test_lab_view_model.dart';
import 'package:indoor_navigation/ui/settings/wifi_positioning_test_lab.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

abstract final class SettingsScreenKeys {
  static const screen = ValueKey<String>('app-section.settings');
}

final class SettingsScreen extends StatelessWidget {
  const SettingsScreen({this.wifiTestLabViewModel, super.key});

  final WifiPositioningTestLabViewModel? wifiTestLabViewModel;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: CampusNavigatorColors.background,
      child: SafeArea(
        bottom: false,
        child: ListView(
          key: SettingsScreenKeys.screen,
          padding: const EdgeInsets.fromLTRB(14, 18, 14, 28),
          children: [
            const Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Settings',
                        style: TextStyle(
                          color: CampusNavigatorColors.text,
                          fontFamily: 'monospace',
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      SizedBox(height: 3),
                      Text(
                        'App preferences and test tools',
                        style: TextStyle(
                          color: CampusNavigatorColors.textMuted,
                          fontSize: 15,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.settings_outlined, size: 34),
              ],
            ),
            if (wifiTestLabViewModel != null) ...[
              const SizedBox(height: 18),
              WifiPositioningTestLab(viewModel: wifiTestLabViewModel!),
            ],
          ],
        ),
      ),
    );
  }
}
