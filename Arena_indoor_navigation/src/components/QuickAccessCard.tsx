import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from './theme';

type QuickAccessCardProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap | keyof typeof MaterialCommunityIcons.glyphMap;
  iconSet?: 'ion' | 'material';
  tone?: 'orange' | 'green';
};

export function QuickAccessCard({ label, icon, iconSet = 'ion', tone = 'green' }: QuickAccessCardProps) {
  const iconColor = tone === 'orange' ? colors.orange : colors.green;
  const Icon = iconSet === 'material' ? MaterialCommunityIcons : Ionicons;

  return (
    <View style={styles.card}>
      <Icon name={icon as never} size={28} color={iconColor} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '31%',
    minHeight: 86,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow,
  },
  label: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});
