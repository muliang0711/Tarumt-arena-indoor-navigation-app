import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { DestinationAnchor, ParsedMapFloor } from '../../../shared/types';
import { colors, radii, spacing } from '../../../shared/theme/tokens';
import { PrimaryActionButton, SecondaryActionButton } from '../../components/controls/ActionButtons';
import { DestinationStepHeader } from '../../components/destination/DestinationStepHeader';
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
  return (
    <ScreenShell header={<DestinationStepHeader />}>
      <View style={styles.content}>
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
        </ScrollView>

        <View style={styles.actionStack}>
          <SecondaryActionButton label="Back" onPress={onBack} />
          <PrimaryActionButton
            label="Continue"
            onPress={onContinue}
            disabled={!selectedDestinationId}
          />
        </View>
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
  actionStack: {
    gap: spacing.sm,
    marginTop: 'auto',
  },
});
