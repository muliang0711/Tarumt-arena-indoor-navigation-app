import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { DestinationAnchor, RouteModel } from '../../../shared/types';
import { spacing } from '../../../shared/theme/tokens';
import { ConfirmRouteActions } from '../../components/confirm/ConfirmRouteActions';
import { ConfirmRouteCard } from '../../components/confirm/ConfirmRouteCard';
import { ConfirmStepHeader } from '../../components/confirm/ConfirmStepHeader';
import { ScreenShell } from '../../components/layout/ScreenShell';

interface ConfirmStepProps {
  buildingName: string;
  currentLocationLabel: string;
  floorLabel: string;
  route: RouteModel | null;
  selectedDestination: DestinationAnchor | null;
  onChooseAnother: () => void;
  onOpenMap: () => void;
}

export function ConfirmStep({
  buildingName,
  currentLocationLabel,
  floorLabel,
  route,
  selectedDestination,
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
        />

        <ConfirmRouteActions onChooseAnother={onChooseAnother} onOpenMap={onOpenMap} />
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
