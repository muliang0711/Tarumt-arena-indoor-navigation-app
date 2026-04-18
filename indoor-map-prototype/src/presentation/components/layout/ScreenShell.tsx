import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

import { colors } from '../../../shared/theme/tokens';
import { ScreenHeader } from './ScreenHeader';

interface ScreenShellProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  header?: React.ReactNode;
  children: React.ReactNode;
}

export function ScreenShell({ eyebrow, title, subtitle, header, children }: ScreenShellProps) {
  return (
    <SafeAreaView style={styles.page}>
      {header ??
        (eyebrow && title && subtitle ? (
          <ScreenHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
        ) : null)}
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F7FAFE',
  },
});
