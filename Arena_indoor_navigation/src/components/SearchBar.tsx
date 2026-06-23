import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from './theme';

type SearchBarProps = {
  placeholder: string;
  compact?: boolean;
};

export function SearchBar({ placeholder, compact = false }: SearchBarProps) {
  return (
    <View style={[styles.search, compact && styles.searchCompact]}>
      <Ionicons name="search" size={20} color={colors.textMuted} />
      <Text style={styles.placeholder}>{placeholder}</Text>
      <Pressable accessibilityRole="button" style={styles.filterButton}>
        <Ionicons name="options" size={18} color={colors.orange} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    minHeight: 56,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: 10,
    ...shadow,
  },
  searchCompact: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  placeholder: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  filterButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.orangeSoft,
  },
});
