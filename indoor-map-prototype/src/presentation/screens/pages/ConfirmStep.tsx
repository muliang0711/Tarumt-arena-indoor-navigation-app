import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { DestinationAnchor, RouteModel } from '../../../shared/types';
import { spacing } from '../../../shared/theme/tokens';
import { ConfirmRouteCard } from '../../components/confirm/ConfirmRouteCard';
import { ConfirmStepHeader } from '../../components/confirm/ConfirmStepHeader';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { ActionDock } from '../../components/shared/ActionDock';

interface ConfirmStepProps {
  buildingName: string;
  currentLocationLabel: string;
  floorLabel: string;
  route: RouteModel | null;
  selectedDestination: DestinationAnchor | null;
  onGoHome: () => void;
  onChooseAnother: () => void;
  onOpenMap: () => void;
}

export function ConfirmStep({
  buildingName,
  currentLocationLabel,
  floorLabel,
  route,
  selectedDestination,
  onGoHome,
  onChooseAnother,
  onOpenMap,
}: ConfirmStepProps) {
  return (
    <ScreenShell header={<ConfirmStepHeader />}>
      <View style={styles.content}>
        <ConfirmRouteCard
          buildingName={buildingName}
          currentLocationLabel={currentLocationLabel}
          floorLabel={floorLabel}
          route={route}
          selectedDestination={selectedDestination}
          onChooseAnother={onChooseAnother}
          onOpenMap={onOpenMap}
        />

        <ActionDock
          onHomePress={onGoHome}
          onStartPress={onChooseAnother}
          onMapPress={onOpenMap}
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
