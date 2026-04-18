import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { DestinationFloorCatalog } from '../../../shared/types';
import { spacing } from '../../../shared/theme/tokens';
import { DestinationRoomCategoryList } from '../../components/destination/DestinationRoomCategoryList';
import { ActionDock } from '../../components/layout/ActionDock';
import { ScreenShell } from '../../components/layout/ScreenShell';

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
  function handleConfirmDestination(destinationId: string) {
    onSelectDestination(destinationId);
    requestAnimationFrame(() => {
      onContinue();
    });
  }

  return (
    <ScreenShell
      eyebrow={floor.label}
      title={`Rooms on ${floor.label}`}
      subtitle="Choose a room from the categories below before continuing to route confirmation."
    >
      <View style={styles.content}>
        <DestinationRoomCategoryList
          floor={floor}
          selectedDestinationId={selectedDestinationId}
          onSelectDestination={onSelectDestination}
          onConfirmDestination={handleConfirmDestination}
        />

        <ActionDock onHomePress={onBack} onStartPress={onContinue} />
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
