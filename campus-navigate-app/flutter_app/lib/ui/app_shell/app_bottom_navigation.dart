import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/view_models/app_shell_view_model.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

abstract final class AppBottomNavigationKeys {
  static ValueKey<String> destination(AppSection section) =>
      ValueKey<String>('app-bottom-navigation.${section.name}');
}

final class AppBottomNavigation extends StatelessWidget {
  const AppBottomNavigation({
    required this.onSectionSelected,
    required this.selectedSection,
    super.key,
  });

  final ValueChanged<AppSection> onSectionSelected;
  final AppSection selectedSection;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        border: Border(
          top: BorderSide(color: CampusNavigatorColors.border, width: 1.5),
        ),
      ),
      child: NavigationBar(
        selectedIndex: selectedSection.index,
        onDestinationSelected: (index) {
          onSectionSelected(AppSection.values[index]);
        },
        destinations: [
          _destination(
            AppSection.home,
            Icons.home_outlined,
            Icons.home,
            'Home',
          ),
          _destination(
            AppSection.navigate,
            Icons.navigation_outlined,
            Icons.navigation,
            'Navigate',
          ),
          _destination(
            AppSection.saved,
            Icons.bookmark_border,
            Icons.bookmark,
            'Saved',
          ),
          _destination(
            AppSection.settings,
            Icons.settings_outlined,
            Icons.settings,
            'Settings',
          ),
        ],
      ),
    );
  }

  NavigationDestination _destination(
    AppSection section,
    IconData icon,
    IconData selectedIcon,
    String label,
  ) {
    return NavigationDestination(
      key: AppBottomNavigationKeys.destination(section),
      icon: Icon(icon),
      selectedIcon: Icon(selectedIcon),
      label: label,
    );
  }
}
