import React from 'react';

import { ScreenHeader } from '../layout/ScreenHeader';

export function DestinationStepHeader() {
  return (
    <ScreenHeader
      eyebrow="Step 1"
      title="Where do you want to go?"
      subtitle="Pick a destination before opening the map. This page keeps route selection off the navigation screen."
    />
  );
}
