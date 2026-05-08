import React from 'react';
import { StyleSheet, View, TextInput } from 'react-native';

import { colors, spacing } from '../../../shared/theme/tokens';
import { DashboardGlassPanel } from './DashboardGlassPanel';
import { SearchIcon } from './DashboardIcons';

interface DashboardSearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  onSubmit?: () => void;
}

export function DashboardSearchField({
  value,
  onChangeText,
  placeholder,
  onSubmit,
}: DashboardSearchFieldProps) {
  return (
    <DashboardGlassPanel style={styles.searchPanel}>
      <View style={styles.searchIconFrame}>
        <SearchIcon color={colors.accentBlue} />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accentBlue}
        style={styles.searchInput}
      />
    </DashboardGlassPanel>
  );
}

const styles = StyleSheet.create({
  searchPanel: {
    minHeight: 58,
  },
  searchIconFrame: {
    position: 'absolute',
    left: spacing.md,
    top: 17,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  searchInput: {
    minHeight: 58,
    paddingLeft: 52,
    paddingRight: spacing.md,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
});
