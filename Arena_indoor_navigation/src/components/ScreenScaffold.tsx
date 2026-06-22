import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { colors } from './theme';

type ScreenScaffoldProps = {
  children: ReactNode;
  scroll?: boolean;
};

export function ScreenScaffold({ children, scroll = true }: ScreenScaffoldProps) {
  if (!scroll) {
    return <View style={styles.container}>{children}</View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
    paddingBottom: 18,
  },
});
