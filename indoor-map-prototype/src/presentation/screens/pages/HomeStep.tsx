import React from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../../../shared/theme/tokens';
import { HomeHeroCard } from '../../components/home/HomeHeroCard';
import { HomeStepHeader } from '../../components/home/HomeStepHeader';
import { ActionDock } from '../../components/shared/ActionDock';
import { HeaderSystemRow } from '../../components/shared/HeaderSystemRow';
import { ScreenShell } from '../../components/layout/ScreenShell';

interface HomeStepProps {
  currentLocationLabel: string;
  onStartNavigation: () => void;
  onOpenMapOverview: () => void;
}

export function HomeStep({
  currentLocationLabel,
  onStartNavigation,
  onOpenMapOverview,
}: HomeStepProps) {
  return (
    <ScreenShell
      header={
        <View style={styles.headerBlock}>
          <HeaderSystemRow />
          <HomeStepHeader title="Campus navigator" />
        </View>
      }
    >
      <View style={styles.content}>
        <HomeHeroCard
          title="Student Center"
          subtitle="Level 3 locked with high confidence"
          currentAnchorLabel={currentLocationLabel}
          mapPackageLabel="village_demo_01"
        />

        <ActionDock
          activeItemId="home"
          onStartPress={onStartNavigation}
          onMapPress={onOpenMapOverview}
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
});
