import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, shadow } from './theme';

type CategoryChipProps = {
  label: string;
  active?: boolean;
};

export function CategoryChip({ label, active = false }: CategoryChipProps) {
  return (
    <Pressable accessibilityRole="button" style={[styles.chip, active && styles.activeChip]}>
      <Text style={[styles.label, active && styles.activeLabel]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 38,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow,
  },
  activeChip: {
    backgroundColor: colors.orange,
  },
  label: {
    maxWidth: 94,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  activeLabel: {
    color: '#ffffff',
  },
});
