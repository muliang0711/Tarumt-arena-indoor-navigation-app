import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors } from '../../../shared/theme/tokens';

interface HeaderSystemRowProps {
  style?: StyleProp<ViewStyle>;
}

export function HeaderSystemRow({ style }: HeaderSystemRowProps) {
  return (
    <View style={[styles.systemRow, style]}>
      <Text style={styles.timeText}>07:23 PM</Text>
      <View style={styles.systemChip}>
        <View style={styles.systemChipDot} />
        <Text style={styles.systemChipLabel}>System Active</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  systemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  systemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accentGreenSoft,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  systemChipDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.accentGreen,
  },
  systemChipLabel: {
    color: colors.accentGreen,
    fontSize: 12,
    fontWeight: '700',
  },
});
