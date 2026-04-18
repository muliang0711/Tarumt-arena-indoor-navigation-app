import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { DestinationAnchor, ParsedMapFloor } from '../../../shared/types';
import { colors, radii, spacing } from '../../../shared/theme/tokens';
import { DestinationStepHeader } from '../../components/destination/DestinationStepHeader';
import { ActionDock } from '../../components/layout/ActionDock';
import { ScreenShell } from '../../components/layout/ScreenShell';

interface DestinationStepProps {
  floor: ParsedMapFloor;
  destinations: DestinationAnchor[];
  selectedDestinationId: string | null;
  onBack: () => void;
  onSelectDestination: (destinationId: string) => void;
  onContinue: () => void;
}

export function DestinationStep({
  floor,
  destinations,
  selectedDestinationId,
  onBack,
  onSelectDestination,
  onContinue,
}: DestinationStepProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleDestinations = normalizedQuery
    ? destinations.filter((destination) => {
        const haystack = [
          destination.label,
          destination.subtitle,
          floor.label,
          'student center',
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      })
    : destinations;

  return (
    <ScreenShell
      header={<DestinationStepHeader query={searchQuery} onQueryChange={setSearchQuery} />}
    >
      <View style={styles.content}>
        <ScrollView contentContainerStyle={styles.destinationList}>
          {visibleDestinations.map((destination) => {
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
          {!visibleDestinations.length ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No matching destination</Text>
              <Text style={styles.emptyStateText}>Try a room code or destination name.</Text>
            </View>
          ) : null}
        </ScrollView>

        <ActionDock
          items={[
            { id: 'back', label: 'Back', icon: 'back', onPress: onBack },
            {
              id: 'continue',
              label: 'Continue',
              icon: 'continue',
              onPress: selectedDestinationId ? onContinue : () => {},
            },
            { id: 'map', label: 'Map', icon: 'map', onPress: () => {} },
          ]}
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
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
