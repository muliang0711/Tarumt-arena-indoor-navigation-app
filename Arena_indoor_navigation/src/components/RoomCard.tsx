import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from './theme';

type RoomCardProps = {
  title: string;
  type: string;
  distance: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  selected?: boolean;
};

export function RoomCard({ title, type, distance, icon, selected = false }: RoomCardProps) {
  return (
    <Pressable accessibilityRole="button" style={[styles.card, selected && styles.selectedCard]}>
      <View style={[styles.iconBox, selected && styles.selectedIconBox]}>
        <MaterialCommunityIcons name={icon} size={25} color={selected ? colors.orange : colors.green} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.type}>{type}</Text>
      </View>
      <Text style={styles.distance}>{distance}</Text>
      {selected ? (
        <View style={styles.check}>
          <Ionicons name="checkmark" size={14} color="#ffffff" />
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 76,
    paddingHorizontal: 12,
    alignItems: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: 12,
    ...shadow,
  },
  selectedCard: {
    borderColor: colors.orange,
    backgroundColor: colors.orangeSoft,
  },
  iconBox: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.greenSoft,
  },
  selectedIconBox: {
    backgroundColor: '#fff2ea',
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  type: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  distance: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  check: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.orange,
  },
});
