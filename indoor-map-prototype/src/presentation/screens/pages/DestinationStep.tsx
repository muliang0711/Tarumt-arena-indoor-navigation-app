import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { DestinationAnchor, ParsedMapFloor } from '../../../shared/types';
import { spacing } from '../../../shared/theme/tokens';
import { DestinationStepHeader } from '../../components/destination/DestinationStepHeader';
import { DestinationSelectionList } from '../../components/destination/DestinationSelectionList';
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
        <DestinationSelectionList
          floor={floor}
          destinations={visibleDestinations}
          selectedDestinationId={selectedDestinationId}
          onSelectDestination={onSelectDestination}
        />

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
});
