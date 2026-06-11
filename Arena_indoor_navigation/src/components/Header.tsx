import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from './theme';

type HeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
};

export function Header({ title, subtitle, onBack }: HeaderProps) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
      ) : (
        <View style={styles.placeholder} />
      )}
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.placeholder} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 58,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow,
  },
  placeholder: {
    width: 38,
  },
  copy: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
});
