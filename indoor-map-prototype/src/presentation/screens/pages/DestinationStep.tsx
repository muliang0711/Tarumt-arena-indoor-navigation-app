import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { DestinationFloorCatalog } from '../../../shared/types';
import { spacing } from '../../../shared/theme/tokens';
import { DestinationStepHeader } from '../../components/destination/DestinationStepHeader';
import { DestinationSelectionList } from '../../components/destination/DestinationSelectionList';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { ActionDock } from '../../components/shared/ActionDock';

interface DestinationStepProps {
  floors: DestinationFloorCatalog[];
  selectedFloorId: string | null;
  onBack: () => void;
  onOpenMapOverview: () => void;
  onSelectFloor: (floorId: string) => void;
}

export function DestinationStep({
  floors,
  selectedFloorId,
  onBack,
  onOpenMapOverview,
  onSelectFloor,
}: DestinationStepProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleFloors = normalizedQuery
    ? floors.filter((floor) => {
        const haystack = [
          floor.label,
          floor.buildingName,
          ...floor.categories.map((category) => category.label),
          ...floor.categories.flatMap((category) => category.rooms.map((room) => room.label)),
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      })
    : floors;

  return (
    <ScreenShell
      header={<DestinationStepHeader query={searchQuery} onQueryChange={setSearchQuery} />}
    >
      <View style={styles.content}>
        <DestinationSelectionList
          floors={visibleFloors}
          selectedFloorId={selectedFloorId}
          onSelectFloor={onSelectFloor}
        />

        <ActionDock
          activeItemId="start"
          onHomePress={onBack}
          onStartPress={() => {}}
          onMapPress={onOpenMapOverview}
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
