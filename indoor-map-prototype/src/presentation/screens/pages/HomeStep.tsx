import React from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../../../shared/theme/tokens';
import { HomeActionStack } from '../../components/home/HomeActionStack';
import { HomeHeroCard } from '../../components/home/HomeHeroCard';
import { HomeStepHeader } from '../../components/home/HomeStepHeader';
import { ScreenShell } from '../../components/layout/ScreenShell';

interface HomeStepProps {
  cameraGranted: boolean;
  currentLocationLabel: string;
  onRequestCamera: () => void;
  onStartNavigation: () => void;
}

export function HomeStep({
  cameraGranted,
  currentLocationLabel,
  onRequestCamera,
  onStartNavigation,
}: HomeStepProps) {
  return (
    <ScreenShell
      header={
        <HomeStepHeader
          eyebrow="Campus navigator"
          title="Indoor location detected"
          subtitle="Confirm your indoor position first, then choose a destination before opening the map."
        />
      }
    >
      <View style={styles.content}>
        <HomeHeroCard
          title="Student Center"
          subtitle="Level 3 locked with high confidence"
          currentAnchorLabel={currentLocationLabel}
          cameraPermissionLabel={cameraGranted ? 'Granted' : 'Not requested'}
          mapPackageLabel="village_demo_01"
        />

        <HomeActionStack
          cameraGranted={cameraGranted}
          onRequestCamera={onRequestCamera}
          onStartNavigation={onStartNavigation}
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
