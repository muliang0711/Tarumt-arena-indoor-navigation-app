import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { spacing } from '../../../shared/theme/tokens';
import { DashboardBottomNavigation } from '../shared/DashboardBottomNavigation';
import { DashboardFloorPlanBackground } from '../shared/DashboardFloorPlanBackground';
import { HomeDashboardHeader } from './HomeDashboardHeader';
import { HomeMapPreviewCard } from './HomeMapPreviewCard';
import { HomePrimaryActions } from './HomePrimaryActions';
import { HomeQuickDestinations } from './HomeQuickDestinations';
import { HomeRecentRoutes } from './HomeRecentRoutes';

interface HomeDashboardProps {
  currentLocationLabel: string;
  onStartNavigation: () => void;
  onOpenMapOverview: () => void;
  onScanAnchor?: () => void;
}

const quickDestinations = ['Lecture Hall', 'Library', 'Toilet', 'Lift', 'Cafeteria', 'Office'];

const recentRoutes = [
  { title: 'DK ABA', detail: 'Level 2', eta: '3 min' },
  { title: 'Library Entrance', detail: 'Level 1', eta: '5 min' },
  { title: 'Cafeteria', detail: 'Ground Floor', eta: '4 min' },
];

export function HomeDashboard({
  onStartNavigation,
  onOpenMapOverview,
  onScanAnchor = () => {},
}: HomeDashboardProps) {
  return (
    <View style={styles.root}>
      <DashboardFloorPlanBackground />

      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <HomeDashboardHeader />
        <HomePrimaryActions onStartNavigation={onStartNavigation} onScanAnchor={onScanAnchor} />
        <HomeQuickDestinations
          destinations={quickDestinations}
          onSelectDestination={onStartNavigation}
        />
        <HomeMapPreviewCard onOpenMapOverview={onOpenMapOverview} />
        <HomeRecentRoutes routes={recentRoutes} onSelectRoute={onStartNavigation} />
      </ScrollView>

      <DashboardBottomNavigation
        activeTabId="home"
        onSearchPress={onStartNavigation}
        onMapPress={onOpenMapOverview}
        onScanPress={onScanAnchor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 116,
    gap: spacing.md,
  },
});
