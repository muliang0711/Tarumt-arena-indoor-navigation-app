import { ImageBackground, StyleSheet, Text, View } from 'react-native';

import { FloorCard } from '../components/FloorCard';
import { Header } from '../components/Header';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { colors, radius } from '../components/theme';

const buildingImage = require('../storage/app-image/image.png');

const floors = [
  { title: 'Level 4', subtitle: 'Green Terrace', roomCount: '12 Rooms' },
  { title: 'Level 3', subtitle: 'Academic Zone', roomCount: '24 Rooms' },
  { title: 'Level 2', subtitle: 'Learning Zone', roomCount: '28 Rooms', selected: true },
  { title: 'Level 1', subtitle: 'Common Zone', roomCount: '20 Rooms' },
  { title: 'Ground Floor', subtitle: 'Main Entrance', roomCount: 'Information Desk' },
];

type FloorSelectionScreenProps = {
  onBack: () => void;
  onChooseFloor: () => void;
};

export function FloorSelectionScreen({ onBack, onChooseFloor }: FloorSelectionScreenProps) {
  return (
    <ScreenScaffold>
      <Header title="Select Floor" subtitle="Choose a floor to explore" onBack={onBack} />
      <ImageBackground source={buildingImage} resizeMode="cover" style={styles.featured} imageStyle={styles.featuredImage}>
        <View style={styles.featuredShade} />
        <View style={styles.featuredCopy}>
          <Text style={styles.featuredTitle}>Arena TARUMT</Text>
          <Text style={styles.featuredSubtitle}>Curved. Green. Inspiring.</Text>
        </View>
      </ImageBackground>

      <View style={styles.list}>
        {floors.map((floor) => (
          <FloorCard
            key={floor.title}
            title={floor.title}
            subtitle={floor.subtitle}
            roomCount={floor.roomCount}
            image={buildingImage}
            selected={floor.selected}
            onPress={floor.selected ? onChooseFloor : undefined}
          />
        ))}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  featured: {
    height: 132,
    overflow: 'hidden',
    borderRadius: radius.lg,
  },
  featuredImage: {
    borderRadius: radius.lg,
  },
  featuredShade: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: 'rgba(20, 14, 8, 0.22)',
  },
  featuredCopy: {
    marginTop: 'auto',
    padding: 16,
  },
  featuredTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  featuredSubtitle: {
    marginTop: 3,
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  list: {
    marginTop: 16,
    gap: 12,
  },
});
