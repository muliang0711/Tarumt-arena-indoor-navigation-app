import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../../shared/theme/tokens';

export function ConfirmStepHeader() {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Confirm route</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
});
