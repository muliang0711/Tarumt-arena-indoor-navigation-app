import React from 'react';

import { HomeDashboard } from '../../components/home/HomeDashboard';
import { ScreenShell } from '../../components/layout/ScreenShell';

interface HomeStepProps {
  currentLocationLabel: string;
  onStartNavigation: () => void;
  onOpenMapOverview: () => void;
  onScanAnchor?: () => void;
}

export function HomeStep(props: HomeStepProps) {
  return (
    <ScreenShell>
      <HomeDashboard {...props} />
    </ScreenShell>
  );
}
