import React from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

import { colors } from '../../../shared/theme/tokens';
import { ScreenHeader } from './ScreenHeader';
import { ShellBackground } from './ShellBackground';

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
      <ShellBackground />
      <View style={styles.contentLayer}>
        {header ??
          (eyebrow && title && subtitle ? (
            <ScreenHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
          ) : null)}
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.pageBackground,
  },
  contentLayer: {
    flex: 1,
  },
});
