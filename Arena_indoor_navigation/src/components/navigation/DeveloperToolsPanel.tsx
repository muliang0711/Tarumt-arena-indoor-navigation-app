import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from '../theme';

type DeveloperToolsPanelProps = {
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export function DeveloperToolsPanel({
  expanded,
  onToggle,
  children,
}: DeveloperToolsPanelProps) {
  return (
    <View style={styles.panel}>
      <Pressable style={styles.header} onPress={onToggle}>
        <View style={styles.titleRow}>
          <Ionicons name="code-slash-outline" size={18} color={colors.textMuted} />
          <Text style={styles.title}>Developer tools</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  body: {
    marginTop: 14,
    gap: 12,
  },
});
