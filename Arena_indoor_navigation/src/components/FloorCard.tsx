import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from './theme';

type FloorCardProps = {
  title: string;
  subtitle: string;
  roomCount: string;
  image: number;
  selected?: boolean;
  onPress?: () => void;
};

export function FloorCard({ title, subtitle, roomCount, image, selected = false, onPress }: FloorCardProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.card, selected && styles.selectedCard]}>
      <Image source={image} style={styles.image} />
      <View style={styles.copy}>
        <Text style={[styles.title, selected && styles.selectedTitle]}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Text style={styles.rooms}>{roomCount}</Text>
      </View>
      {selected ? (
        <View style={styles.selectedIcon}>
          <Ionicons name="checkmark" size={15} color="#ffffff" />
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 86,
    padding: 8,
    alignItems: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: 14,
    ...shadow,
  },
  selectedCard: {
    borderColor: colors.orange,
    backgroundColor: colors.orangeSoft,
  },
  image: {
    width: 116,
    height: 70,
    borderRadius: radius.sm,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  selectedTitle: {
    color: colors.orange,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  rooms: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
  selectedIcon: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.orange,
  },
});
