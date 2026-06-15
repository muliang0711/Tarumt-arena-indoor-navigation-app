import { Ionicons } from '@expo/vector-icons';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import { QuickAccessCard } from '../components/QuickAccessCard';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SearchBar } from '../components/SearchBar';
import { colors, radius, shadow } from '../components/theme';

const heroImage = require('../storage/app-image/dbe31c6f-8daf-49f7-966e-634aa6ececd3.png');

const quickAccess = [
  { label: 'Classrooms', icon: 'school', tone: 'orange' },
  { label: 'Lift', icon: 'business', tone: 'green' },
  { label: 'Toilet', icon: 'male-female', tone: 'green' },
  { label: 'Cafeteria', icon: 'restaurant', tone: 'orange' },
  { label: 'Study Area', icon: 'book', tone: 'green' },
  { label: 'Office', icon: 'briefcase', tone: 'green' },
] as const;

type HomeScreenProps = {
  onOpenFloors: () => void;
};

export function HomeScreen({ onOpenFloors }: HomeScreenProps) {
  return (
    <ScreenScaffold>
      <ImageBackground source={heroImage} resizeMode="cover" style={styles.hero} imageStyle={styles.heroImage}>
        <View style={styles.heroShade} />
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.logoMain}>arena</Text>
            <Text style={styles.logoSub}>TARUMT</Text>
          </View>
          <Pressable accessibilityRole="button" style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Arena{'\n'}TARUMT</Text>
          <Text style={styles.heroAccent}>Navigator</Text>
          <Text style={styles.heroSubtitle}>Find your way. Anytime, anywhere.</Text>
        </View>
      </ImageBackground>

      <View style={styles.searchWrap}>
        <SearchBar placeholder="Search destination..." />
      </View>

      <Pressable accessibilityRole="button" onPress={onOpenFloors} style={styles.primaryButton}>
        <Text style={styles.primaryText}>Start Navigation</Text>
        <Ionicons name="navigate" size={20} color="#ffffff" />
      </Pressable>

      <Text style={styles.sectionTitle}>Quick Access</Text>
      <View style={styles.grid}>
        {quickAccess.map((item) => (
          <QuickAccessCard key={item.label} label={item.label} icon={item.icon} tone={item.tone} />
        ))}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 330,
    overflow: 'hidden',
    borderRadius: radius.lg,
  },
  heroImage: {
    borderRadius: radius.lg,
  },
  heroShade: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: 'rgba(21, 14, 8, 0.27)',
  },
  heroTop: {
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logoMain: {
    color: colors.orange,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 24,
  },
  logoSub: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  heroCopy: {
    marginTop: 'auto',
    paddingHorizontal: 18,
    paddingBottom: 22,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 35,
  },
  heroAccent: {
    color: colors.orange,
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 29,
  },
  heroSubtitle: {
    marginTop: 8,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  searchWrap: {
    marginTop: 12,
    paddingHorizontal: 0,
  },
  primaryButton: {
    minHeight: 56,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
    borderRadius: radius.md,
    backgroundColor: colors.orange,
    ...shadow,
  },
  primaryText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 12,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
});
