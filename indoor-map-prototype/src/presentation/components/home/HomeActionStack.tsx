import React from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../../../shared/theme/tokens';
import { PrimaryActionButton, SecondaryActionButton } from '../controls/ActionButtons';

interface HomeActionStackProps {
  cameraGranted: boolean;
  onRequestCamera: () => void;
  onStartNavigation: () => void;
}

export function HomeActionStack({
  cameraGranted,
  onRequestCamera,
  onStartNavigation,
}: HomeActionStackProps) {
  return (
    <View style={styles.actionStack}>
      <SecondaryActionButton
        label={cameraGranted ? 'Camera ready' : 'Request camera'}
        onPress={onRequestCamera}
      />
      <PrimaryActionButton label="Start navigation" onPress={onStartNavigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  actionStack: {
    gap: spacing.sm,
    marginTop: 'auto',
  },
});
