import React from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../../../shared/theme/tokens';
import { HomeActionStack } from '../../components/home/HomeActionStack';
import { HomeHeroCard } from '../../components/home/HomeHeroCard';
import { HomeStepHeader } from '../../components/home/HomeStepHeader';
import { ScreenShell } from '../../components/layout/ScreenShell';

interface HomeStepProps {
  currentLocationLabel: string;
  onStartNavigation: () => void;
}

export function HomeStep({
  currentLocationLabel,
  onStartNavigation,
}: HomeStepProps) {
  return (
    <ScreenShell
      header={
        <HomeStepHeader title="Campus navigator" />
      }
    >
      <View style={styles.content}>
        <HomeHeroCard
          title="Student Center"
          subtitle="Level 3 locked with high confidence"
          currentAnchorLabel={currentLocationLabel}
          mapPackageLabel="village_demo_01"
        />

        <HomeActionStack onStartNavigation={onStartNavigation} />
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
