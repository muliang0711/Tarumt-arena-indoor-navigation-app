import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Header } from '../components/Header';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SearchBar } from '../components/SearchBar';
import { colors, radius, shadow } from '../components/theme';
import { ArenaMapView } from '../mapEngine/map-controller';

const destinations: Array<{
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  active?: boolean;
}> = [
  { label: 'Entrance', icon: 'walk', active: true },
  { label: 'Lecture Hall', icon: 'school-outline' },
  { label: 'Lift Lobby', icon: 'elevator-passenger' },
];

export function MapScreen() {
  return (
    <ScreenScaffold>
      <Header title="Indoor Map" subtitle="Level 2 navigation" />
      <SearchBar placeholder="Search on map..." />

      <View style={styles.mapCard}>
        <View style={styles.mapToolbar}>
          <View style={styles.floorPill}>
            <Ionicons name="layers" size={15} color={colors.orange} />
            <Text style={styles.floorText}>Level 2</Text>
          </View>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Live</Text>
          </View>
        </View>

        <ArenaMapView height={390} />
      </View>

      <View style={styles.routeSummary}>
        <View>
          <Text style={styles.summaryLabel}>Map render</Text>
          <Text style={styles.summaryTitle}>Village demo map loaded</Text>
        </View>
        <View style={styles.distanceBadge}>
          <Text style={styles.distanceText}>Level 2</Text>
        </View>
      </View>

      <View style={styles.destinationList}>
        {destinations.map((item) => (
          <View key={item.label} style={[styles.destination, item.active && styles.destinationActive]}>
            <MaterialCommunityIcons
              name={item.icon}
              size={22}
              color={item.active ? colors.orange : colors.green}
            />
            <Text style={[styles.destinationText, item.active && styles.destinationTextActive]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  mapCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow,
  },
  mapToolbar: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floorPill: {
    minHeight: 34,
    paddingHorizontal: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.orangeSoft,
  },
  floorText: {
    color: colors.orange,
    fontSize: 12,
    fontWeight: '900',
  },
  statusPill: {
    minHeight: 34,
    paddingHorizontal: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.greenSoft,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.green,
  },
  statusText: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '900',
  },
  routeSummary: {
    minHeight: 74,
    marginTop: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryTitle: {
    marginTop: 4,
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  distanceBadge: {
    minHeight: 38,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.orange,
  },
  distanceText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  destinationList: {
    marginTop: 16,
    gap: 10,
  },
  destination: {
    minHeight: 56,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  destinationActive: {
    backgroundColor: colors.orangeSoft,
  },
  destinationText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  destinationTextActive: {
    color: colors.orange,
  },
});
