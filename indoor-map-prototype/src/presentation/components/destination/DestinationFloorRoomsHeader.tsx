import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../../shared/theme/tokens';
import { DestinationSearchBar } from '../shared/DestinationSearchBar';
import { HeaderSystemRow } from '../shared/HeaderSystemRow';

interface DestinationFloorRoomsHeaderProps {
  floorLabel: string;
  query: string;
  onQueryChange: (value: string) => void;
}

export function DestinationFloorRoomsHeader({
  floorLabel,
  query,
  onQueryChange,
}: DestinationFloorRoomsHeaderProps) {
  return (
    <View style={styles.pageHeader}>
      <HeaderSystemRow style={styles.systemRow} />

      <View style={styles.titleBlock}>
        <Text style={styles.eyebrow}>{floorLabel}</Text>
        <Text style={styles.pageTitle}>Choose a room</Text>
        <Text style={styles.pageSubtitle}>
          Search this floor or tap a room once to continue.
        </Text>
      </View>

      <DestinationSearchBar
        query={query}
        onQueryChange={onQueryChange}
        promptText={`Search rooms, labs, offices, or facilities on ${floorLabel}.`}
        placeholder={`Search a room on ${floorLabel}`}
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
  titleBlock: {
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  pageTitle: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
  },
  pageSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
