import 'package:flutter/material.dart';

abstract final class IndoorNavigationColors {
  static const Color background = Color(0xFFF6F7F9);
  static const Color border = Color(0xFFD9DEE7);
  static const Color blue = Color(0xFF2563EB);
  static const Color blueDark = Color(0xFF1D4ED8);
  static const Color muted = Color(0xFF667085);
  static const Color panel = Colors.white;
  static const Color slate = Color(0xFF0F172A);
  static const Color slateSoft = Color(0xFF334155);
  static const Color teal = Color(0xFF0F766E);
}

abstract final class CampusNavigatorColors {
  static const Color accent = Color(0xFFB16043);
  static const Color accentBright = Color(0xFFED8734);
  static const Color background = Color(0xFFF3EFE4);
  static const Color border = Color(0xFFC8C0AF);
  static const Color card = Color(0xFFFFFDF8);
  static const Color icon = Color(0xFF747A75);
  static const Color shadow = Color(0xFFC9C1B0);
  static const Color text = Color(0xFF292E2C);
  static const Color textMuted = Color(0xFF747A75);
}

ThemeData createIndoorNavigationTheme() {
  final colorScheme = ColorScheme.fromSeed(
    seedColor: CampusNavigatorColors.accent,
    surface: CampusNavigatorColors.card,
  );
  return ThemeData(
    colorScheme: colorScheme,
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: CampusNavigatorColors.card,
      elevation: 0,
      height: 74,
      indicatorColor: Colors.transparent,
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(
          color: selected
              ? CampusNavigatorColors.accent
              : CampusNavigatorColors.icon,
          size: 28,
        );
      }),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          color: selected
              ? CampusNavigatorColors.accent
              : CampusNavigatorColors.textMuted,
          fontSize: 12,
          fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
        );
      }),
      surfaceTintColor: Colors.transparent,
    ),
    scaffoldBackgroundColor: CampusNavigatorColors.background,
    textTheme: ThemeData.light().textTheme.apply(
      bodyColor: CampusNavigatorColors.text,
      displayColor: CampusNavigatorColors.text,
    ),
    useMaterial3: true,
  );
}
