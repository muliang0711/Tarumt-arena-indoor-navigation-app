import React from 'react';

import { ScreenHeader } from '../layout/ScreenHeader';

export function ConfirmStepHeader() {
  return (
    <ScreenHeader
      eyebrow="Step 2"
      title="Confirm route"
      subtitle="Review the indoor route first. The live map opens only after you confirm."
    />
  );
}
