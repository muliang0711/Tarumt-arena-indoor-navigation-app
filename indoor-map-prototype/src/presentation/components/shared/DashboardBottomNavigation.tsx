import React from 'react';
import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../../../shared/theme/tokens';
import { HomeIcon, MapIcon, ScanIcon, SearchIcon, SettingsIcon } from './DashboardIcons';

export type DashboardTabId = 'home' | 'search' | 'map' | 'scan' | 'settings';

interface DashboardBottomNavigationProps {
  activeTabId: DashboardTabId;
  onHomePress?: () => void;
  onSearchPress?: () => void;
  onMapPress?: () => void;
  onScanPress?: () => void;
  onSettingsPress?: () => void;
}

export function DashboardBottomNavigation({
  activeTabId,
  onHomePress = () => {},
  onSearchPress = () => {},
  onMapPress = () => {},
  onScanPress = () => {},
  onSettingsPress = () => {},
}: DashboardBottomNavigationProps) {
  const tabs: Array<{
    id: DashboardTabId;
    label: string;
    icon: (color: string) => React.ReactNode;
    onPress: () => void;
  }> = [
    { id: 'home', label: 'Home', icon: (color) => <HomeIcon color={color} />, onPress: onHomePress },
    {
      id: 'search',
      label: 'Search',
      icon: (color) => <SearchIcon color={color} />,
      onPress: onSearchPress,
    },
    { id: 'map', label: 'Map', icon: (color) => <MapIcon color={color} />, onPress: onMapPress },
    { id: 'scan', label: 'Scan', icon: (color) => <ScanIcon color={color} />, onPress: onScanPress },
    {
      id: 'settings',
      label: 'Settings',
      icon: (color) => <SettingsIcon color={color} />,
      onPress: onSettingsPress,
    },
  ];

  return (
    <View style={styles.bottomNavWrap}>
      <BlurView
        tint="light"
        intensity={46}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFillObject}
      />
      <View pointerEvents="none" style={styles.bottomNavFill} />
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        const iconColor = active ? colors.accentBlue : colors.textSecondary;

        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={tab.onPress}
            style={({ pressed }) => [
              styles.bottomTab,
              active && styles.bottomTabActive,
              pressed && styles.pressed,
            ]}
          >
            {tab.icon(iconColor)}
            <Text style={[styles.bottomTabText, active && styles.bottomTabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNavWrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    minHeight: 72,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    shadowColor: 'rgba(15, 23, 42, 0.2)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 22,
    elevation: 12,
  },
  bottomNavFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
  },
  bottomTab: {
    flex: 1,
    minHeight: 56,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  bottomTabActive: {
    backgroundColor: 'rgba(234, 242, 255, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(47, 107, 255, 0.18)',
  },
  bottomTabText: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
  bottomTabTextActive: {
    color: colors.accentBlue,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.78,
  },
});
