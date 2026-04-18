import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { DestinationFloorCatalog } from '../../../shared/types';
import { colors, radii, spacing } from '../../../shared/theme/tokens';

interface DestinationSelectionListProps {
  floors: DestinationFloorCatalog[];
  selectedFloorId: string | null;
  onSelectFloor: (floorId: string) => void;
}

export function DestinationSelectionList({
  floors,
  selectedFloorId,
  onSelectFloor,
}: DestinationSelectionListProps) {
  return (
    <ScrollView contentContainerStyle={styles.destinationList}>
      {floors.map((floor) => {
        const selected = floor.id === selectedFloorId;
        return (
          <TouchableOpacity
            key={floor.id}
            activeOpacity={0.9}
            onPress={() => onSelectFloor(floor.id)}
            style={[
              styles.destinationCard,
              selected && {
                borderColor: colors.accentBlue,
                backgroundColor: `${colors.accentBlue}14`,
              },
            ]}
          >
            <View style={styles.floorBadge}>
              <Text style={styles.floorBadgeText}>
                {floor.label === 'Ground Floor' ? 'G' : floor.label[0]}
              </Text>
            </View>
            <View style={styles.destinationTextBlock}>
              <Text style={styles.destinationTitle}>{floor.label}</Text>
              <Text style={styles.destinationMeta}>
                {floor.roomCount} rooms across {floor.categories.length} categories
              </Text>
              <Text style={styles.destinationMeta}>
                {floor.buildingName} / {floor.availability === 'available' ? 'Active now' : 'Preview catalog'}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
      {!floors.length ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No floor available</Text>
          <Text style={styles.emptyStateText}>Check the prototype floor catalog data.</Text>
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
  floorBadge: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floorBadgeText: {
    color: colors.accentBlue,
    fontSize: 17,
    fontWeight: '800',
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
