import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { DestinationAnchor, ParsedMapFloor } from '../../../shared/types';
import { colors, radii, spacing } from '../../../shared/theme/tokens';

interface DestinationSelectionListProps {
  floor: ParsedMapFloor;
  destinations: DestinationAnchor[];
  selectedDestinationId: string | null;
  onSelectDestination: (destinationId: string) => void;
}

export function DestinationSelectionList({
  floor,
  destinations,
  selectedDestinationId,
  onSelectDestination,
}: DestinationSelectionListProps) {
  return (
    <ScrollView contentContainerStyle={styles.destinationList}>
      {destinations.map((destination) => {
        const selected = destination.id === selectedDestinationId;
        return (
          <TouchableOpacity
            key={destination.id}
            activeOpacity={0.9}
            onPress={() => onSelectDestination(destination.id)}
            style={[
              styles.destinationCard,
              selected && {
                borderColor: destination.accentColor,
                backgroundColor: `${destination.accentColor}18`,
              },
            ]}
          >
            <View
              style={[
                styles.destinationAccent,
                { backgroundColor: destination.accentColor },
              ]}
            />
            <View style={styles.destinationTextBlock}>
              <Text style={styles.destinationTitle}>{destination.label}</Text>
              <Text style={styles.destinationMeta}>{destination.subtitle}</Text>
              <Text style={styles.destinationMeta}>Student Center / {floor.label}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
      {!destinations.length ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No matching destination</Text>
          <Text style={styles.emptyStateText}>Try a room code or destination name.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  destinationList: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.glassStroke,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  emptyStateTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  emptyStateText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  destinationCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.glassStroke,
    padding: spacing.md,
  },
  destinationAccent: {
    width: 14,
    alignSelf: 'stretch',
    borderRadius: radii.pill,
  },
  destinationTextBlock: {
    flex: 1,
    gap: 4,
  },
  destinationTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  destinationMeta: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});
