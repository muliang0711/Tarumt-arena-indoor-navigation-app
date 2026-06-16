import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from './theme';

export type ScreenKey = 'home' | 'map' | 'floors' | 'rooms';

type PreviewTabsProps = {
  activeScreen: ScreenKey;
  onChange: (screen: ScreenKey) => void;
};

const tabs: Array<{ key: ScreenKey; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'map', label: 'Map', icon: 'map' },
  { key: 'floors', label: 'Floors', icon: 'layers' },
  { key: 'rooms', label: 'Rooms', icon: 'business' },
];

export function PreviewTabs({ activeScreen, onChange }: PreviewTabsProps) {
  return (
    <View style={styles.bar}>
      {tabs.map((tab) => {
        const active = tab.key === activeScreen;
        return (
          <Pressable key={tab.key} accessibilityRole="button" onPress={() => onChange(tab.key)} style={styles.tab}>
            <Ionicons name={tab.icon} size={18} color={active ? colors.orange : colors.textMuted} />
            <Text style={[styles.label, active && styles.activeLabel]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 64,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tab: {
    minWidth: 78,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  activeLabel: {
    color: colors.orange,
  },
});
