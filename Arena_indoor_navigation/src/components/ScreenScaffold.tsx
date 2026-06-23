import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { colors } from './theme';

type ScreenScaffoldProps = {
  children: ReactNode;
  scroll?: boolean;
  scrollEnabled?: boolean;
  bottomPadding?: number;
};

export function ScreenScaffold({
  children,
  scroll = true,
  scrollEnabled = true,
  bottomPadding,
}: ScreenScaffoldProps) {
  if (!scroll) {
    return <View style={styles.container}>{children}</View>;
  }

  return (
    <ScrollView
      scrollEnabled={scrollEnabled}
      contentContainerStyle={[
        styles.content,
        !scrollEnabled && styles.contentBounded,
        bottomPadding !== undefined && { paddingBottom: bottomPadding },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  content: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 120,
  },
  contentBounded: {
    flex: 1,
  },
});
