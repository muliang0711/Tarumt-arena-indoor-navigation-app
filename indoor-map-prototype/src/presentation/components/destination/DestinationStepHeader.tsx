import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../../shared/theme/tokens';
import { DestinationSearchBar } from '../shared/DestinationSearchBar';
import { HeaderSystemRow } from '../shared/HeaderSystemRow';

interface DestinationStepHeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
}

export function DestinationStepHeader({
  query,
  onQueryChange,
}: DestinationStepHeaderProps) {
  return (
    <View style={styles.pageHeader}>
      <HeaderSystemRow style={styles.systemRow} />

      <Text style={styles.pageTitle}>Where you want to go?</Text>

      <DestinationSearchBar
        query={query}
        onQueryChange={onQueryChange}
        promptText="Search buildings, rooms, facilities, or destinations. Example: TA201"
        placeholder="Search destination, room, or facility"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  systemRow: {
    marginBottom: spacing.sm,
  },
  pageTitle: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
  },
});
