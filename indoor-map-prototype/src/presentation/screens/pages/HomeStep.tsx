import React from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../../../shared/theme/tokens';
import { PrimaryActionButton, SecondaryActionButton } from '../../components/controls/ActionButtons';
import { HomeHeroCard } from '../../components/home/HomeHeroCard';
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
      eyebrow="Campus navigator"
      title="Indoor location detected"
      subtitle="Confirm your indoor position first, then choose a destination before opening the map."
    >
      <View style={styles.content}>
        <HomeHeroCard
          title="Student Center"
          subtitle="Level 3 locked with high confidence"
          currentAnchorLabel={currentLocationLabel}
          cameraPermissionLabel={cameraGranted ? 'Granted' : 'Not requested'}
          mapPackageLabel="village_demo_01"
        />

        <View style={styles.actionStack}>
          <SecondaryActionButton
            label={cameraGranted ? 'Camera ready' : 'Request camera'}
            onPress={onRequestCamera}
          />
          <PrimaryActionButton label="Start navigation" onPress={onStartNavigation} />
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
  actionStack: {
    gap: spacing.sm,
    marginTop: 'auto',
  },
});
