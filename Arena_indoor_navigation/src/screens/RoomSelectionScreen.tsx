import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryChip } from '../components/CategoryChip';
import { Header } from '../components/Header';
import { RoomCard } from '../components/RoomCard';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { colors, radius, shadow } from '../components/theme';

const categories = ['All', 'Classroom', 'Lab', 'Office', 'Meeting'];

const rooms: Array<{
  title: string;
  type: string;
  distance: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  selected?: boolean;
}> = [
  { title: 'A101', type: 'Classroom', distance: '40 m', icon: 'school' },
  { title: 'A102', type: 'Classroom', distance: '55 m', icon: 'school' },
  { title: 'Computer Lab 1', type: 'Computer Lab', distance: '65 m', icon: 'desktop-classic' },
  { title: 'Lecture Hall A', type: 'Lecture Hall', distance: '80 m', icon: 'google-classroom' },
  { title: 'Admin Office', type: 'Office', distance: '90 m', icon: 'briefcase' },
  { title: 'Restroom (Level 2)', type: 'Restroom', distance: '45 m', icon: 'human-male-female-child', selected: true },
  { title: 'Study Area 2B', type: 'Study Area', distance: '70 m', icon: 'book-open-page-variant' },
];

type RoomSelectionScreenProps = {
  onBack: () => void;
};

export function RoomSelectionScreen({ onBack }: RoomSelectionScreenProps) {
  return (
    <ScreenScaffold>
      <Header title="Choose Room" onBack={onBack} />

      <View style={styles.floorBadge}>
        <MaterialCommunityIcons name="office-building-marker" size={17} color={colors.orange} />
        <Text style={styles.floorText}>Level 2</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
        {categories.map((category, index) => (
          <CategoryChip key={category} label={category} active={index === 0} />
        ))}
      </ScrollView>

      <View style={styles.list}>
        {rooms.map((room) => (
          <RoomCard key={room.title} {...room} />
        ))}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  floorBadge: {
    minHeight: 40,
    alignSelf: 'center',
    paddingHorizontal: 18,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow,
  },
  floorText: {
    color: colors.orange,
    fontSize: 13,
    fontWeight: '900',
  },
  categories: {
    paddingVertical: 20,
    gap: 12,
  },
  list: {
    gap: 12,
    paddingBottom: 4,
  },
});
