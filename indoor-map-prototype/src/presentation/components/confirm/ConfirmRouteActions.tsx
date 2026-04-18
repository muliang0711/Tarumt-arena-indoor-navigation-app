import React from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../../../shared/theme/tokens';
import { PrimaryActionButton, SecondaryActionButton } from '../controls/ActionButtons';

interface ConfirmRouteActionsProps {
  onChooseAnother: () => void;
  onOpenMap: () => void;
}

export function ConfirmRouteActions({
  onChooseAnother,
  onOpenMap,
}: ConfirmRouteActionsProps) {
  return (
    <View style={styles.actionStack}>
      <SecondaryActionButton label="Choose another" onPress={onChooseAnother} />
      <PrimaryActionButton label="Open navigation map" onPress={onOpenMap} />
    </View>
  );
}

const styles = StyleSheet.create({
  actionStack: {
    gap: spacing.sm,
    marginTop: 'auto',
  },
});
