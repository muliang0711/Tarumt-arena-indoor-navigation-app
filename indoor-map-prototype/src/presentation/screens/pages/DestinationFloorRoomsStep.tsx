import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { DestinationFloorCatalog } from '../../../shared/types';
import { spacing } from '../../../shared/theme/tokens';
import { DestinationFloorRoomsHeader } from '../../components/destination/DestinationFloorRoomsHeader';
import { DestinationRoomCategoryList } from '../../components/destination/DestinationRoomCategoryList';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { ActionDock } from '../../components/shared/ActionDock';

interface DestinationFloorRoomsStepProps {
  floor: DestinationFloorCatalog;
  selectedDestinationId: string | null;
  onBack: () => void;
  onSelectDestination: (destinationId: string) => void;
  onContinue: () => void;
}

export function DestinationFloorRoomsStep({
  floor,
  selectedDestinationId,
  onBack,
  onSelectDestination,
  onContinue,
}: DestinationFloorRoomsStepProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleFloor = normalizedQuery
    ? {
        ...floor,
        categories: floor.categories
          .map((category) => {
            const rooms = category.rooms.filter((room) => {
              const haystack = [category.label, room.label, room.subtitle].join(' ').toLowerCase();
              return haystack.includes(normalizedQuery);
            });

            return {
              ...category,
              rooms,
            };
          })
          .filter((category) => category.rooms.length > 0),
      }
    : floor;

  function handleConfirmDestination(destinationId: string) {
    onSelectDestination(destinationId);
    requestAnimationFrame(() => {
      onContinue();
    });
  }

  return (
    <ScreenShell
      header={
        <DestinationFloorRoomsHeader
          floorLabel={floor.label}
          query={searchQuery}
          onQueryChange={setSearchQuery}
        />
      }
    >
      <View style={styles.content}>
        <DestinationRoomCategoryList
          floor={visibleFloor}
          selectedDestinationId={selectedDestinationId}
          onSelectDestination={onSelectDestination}
          onConfirmDestination={handleConfirmDestination}
        />

        <ActionDock onHomePress={onBack} onStartPress={onBack} />
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
