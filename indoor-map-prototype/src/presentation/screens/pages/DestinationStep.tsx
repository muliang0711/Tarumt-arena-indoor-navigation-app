import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { DestinationFloorCatalog } from '../../../shared/types';
import { colors, radii, spacing } from '../../../shared/theme/tokens';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { DashboardBottomNavigation } from '../../components/shared/DashboardBottomNavigation';
import { DashboardFloorPlanBackground } from '../../components/shared/DashboardFloorPlanBackground';
import { DashboardGlassPanel } from '../../components/shared/DashboardGlassPanel';
import { MapIcon } from '../../components/shared/DashboardIcons';
import { DashboardSearchField } from '../../components/shared/DashboardSearchField';
import { HeaderSystemRow } from '../../components/shared/HeaderSystemRow';

interface DestinationStepProps {
  floors: DestinationFloorCatalog[];
  selectedFloorId: string | null;
  onBack: () => void;
  onOpenMapOverview: () => void;
  onSelectFloor: (floorId: string) => void;
  onConfirmDestination: (destinationId: string) => void;
}

const quickDestinations = ['Lecture Hall', 'Library', 'Toilet', 'Lift', 'Cafeteria', 'Office'];

export function DestinationStep({
  floors,
  selectedFloorId,
  onBack,
  onOpenMapOverview,
  onSelectFloor,
  onConfirmDestination,
}: DestinationStepProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleFloors = useMemo(() => {
    if (!normalizedQuery) {
      return floors;
    }

    return floors.filter((floor) => {
      const haystack = [
        floor.label,
        floor.buildingName,
        floor.availability,
        ...floor.categories.map((category) => category.label),
        ...floor.categories.flatMap((category) =>
          category.rooms.map((room) => `${room.label} ${room.subtitle}`)
        ),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [floors, normalizedQuery]);

  const activeFloor = floors.find((floor) => floor.availability === 'available') ?? floors[0];
  const buildingName = activeFloor?.buildingName ?? 'Student Center';
  const activeFloorLabel = activeFloor?.label ?? 'Level 3';

  const recentDestinations = useMemo(
    () =>
      floors
        .flatMap((floor) =>
          floor.categories.flatMap((category) =>
            category.rooms.map((room) => ({
              id: room.id,
              title: room.label,
              detail: `${room.floorLabel} · ${category.label}`,
            }))
          )
        )
        .slice(0, 3),
    [floors]
  );

  return (
    <ScreenShell>
      <View style={styles.root}>
        <DashboardFloorPlanBackground />

        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.headerBlock}>
            <HeaderSystemRow />
            <View style={styles.titleRow}>
              <View style={styles.titleCopy}>
                <Text style={styles.title}>Where you want to go?</Text>
                <Text style={styles.subtitle}>
                  Search destinations or browse mapped floors in {buildingName}.
                </Text>
              </View>
              <View style={styles.contextPill}>
                <MapIcon color={colors.accentBlue} />
                <Text style={styles.contextPillText}>{activeFloorLabel}</Text>
              </View>
            </View>
          </View>

          <DashboardSearchField
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search classroom, office, toilet, lift..."
          />

          <View style={styles.sectionBlock}>
            <Text style={styles.blockTitle}>Quick Destinations</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickList}
            >
              {quickDestinations.map((destination) => (
                <Pressable
                  key={destination}
                  accessibilityRole="button"
                  onPress={() => setSearchQuery(destination)}
                  style={({ pressed }) => [styles.quickChip, pressed && styles.pressed]}
                >
                  <Text style={styles.quickChipText}>{destination}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.blockTitle}>Browse by Floor</Text>
              <Text style={styles.sectionMeta}>{visibleFloors.length} available</Text>
            </View>
            <View style={styles.floorList}>
              {visibleFloors.map((floor, index) => (
                <FloorCard
                  key={floor.id}
                  floor={floor}
                  index={index}
                  selected={floor.id === selectedFloorId}
                  onPress={() => onSelectFloor(floor.id)}
                />
              ))}
              {!visibleFloors.length ? (
                <DashboardGlassPanel contentStyle={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No matching floors</Text>
                  <Text style={styles.emptyText}>Try a room name, facility, floor, or category.</Text>
                </DashboardGlassPanel>
              ) : null}
            </View>
          </View>

          <DashboardGlassPanel contentStyle={styles.recentCard}>
            <Text style={styles.blockTitle}>Recent Destinations</Text>
            {recentDestinations.map((item) => (
              <Pressable
                key={item.title}
                accessibilityRole="button"
                onPress={() => onConfirmDestination(item.id)}
                style={({ pressed }) => [styles.recentRow, pressed && styles.pressed]}
              >
                <View style={styles.recentDot} />
                <View style={styles.recentCopy}>
                  <Text style={styles.recentTitle}>{item.title}</Text>
                  <Text style={styles.recentDetail}>{item.detail}</Text>
                </View>
                <Text style={styles.recentAction}>Search</Text>
              </Pressable>
            ))}
          </DashboardGlassPanel>
        </ScrollView>

        <DashboardBottomNavigation
          activeTabId="search"
          onHomePress={onBack}
          onSearchPress={() => setSearchQuery('')}
          onMapPress={onOpenMapOverview}
        />
      </View>
    </ScreenShell>
  );
}

function FloorCard({
  floor,
  index,
  selected,
  onPress,
}: {
  floor: DestinationFloorCatalog;
  index: number;
  selected: boolean;
  onPress: () => void;
}) {
  const stateLabel =
    floor.availability === 'available'
      ? 'Active now'
      : index <= 2
        ? 'Nearby'
        : 'Preview available';
  const firstCategory = floor.categories[0]?.label ?? 'Rooms';
  const secondCategory = floor.categories[1]?.label ?? 'Facilities';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.floorCard,
        selected && styles.floorCardSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.floorBadge}>
        <Text style={styles.floorBadgeText}>{floor.label === 'Ground Floor' ? 'G' : floor.label[0]}</Text>
      </View>
      <View style={styles.floorCopy}>
        <View style={styles.floorTitleRow}>
          <Text style={styles.floorTitle}>{floor.label}</Text>
          <Text style={[styles.floorState, floor.availability === 'available' && styles.floorStateActive]}>
            {stateLabel}
          </Text>
        </View>
        <Text style={styles.floorBuilding}>{floor.buildingName}</Text>
        <View style={styles.floorStatsRow}>
          <Text style={styles.floorStat}>{floor.roomCount} rooms</Text>
          <Text style={styles.floorStat}>{floor.categories.length} categories</Text>
          <Text style={styles.floorStat} numberOfLines={1}>
            {firstCategory} / {secondCategory}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pageBackground,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 116,
    gap: spacing.md,
  },
  headerBlock: {
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  contextPill: {
    minHeight: 34,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.accentBlueSoft,
    borderWidth: 1,
    borderColor: 'rgba(47, 107, 255, 0.18)',
  },
  contextPillText: {
    color: colors.accentBlue,
    fontSize: 12,
    fontWeight: '900',
  },
  sectionBlock: {
    gap: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  blockTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  sectionMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  quickList: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  quickChip: {
    minHeight: 40,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.84)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  floorList: {
    gap: spacing.sm,
  },
  floorCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(217, 226, 242, 0.86)',
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    padding: spacing.md,
    shadowColor: 'rgba(15, 23, 42, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.75,
    shadowRadius: 16,
    elevation: 4,
  },
  floorCardSelected: {
    borderColor: 'rgba(47, 107, 255, 0.44)',
    backgroundColor: 'rgba(234, 242, 255, 0.9)',
  },
  floorBadge: {
    width: 50,
    height: 50,
    borderRadius: radii.md,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floorBadgeText: {
    color: colors.accentBlue,
    fontSize: 17,
    fontWeight: '900',
  },
  floorCopy: {
    flex: 1,
    gap: 4,
  },
  floorTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  floorTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
  floorState: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '900',
  },
  floorStateActive: {
    color: '#047857',
  },
  floorBuilding: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  floorStatsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  floorStat: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  recentCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  recentRow: {
    minHeight: 52,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(248, 250, 252, 0.74)',
  },
  recentDot: {
    width: 9,
    height: 9,
    borderRadius: radii.pill,
    backgroundColor: colors.accentBlue,
  },
  recentCopy: {
    flex: 1,
  },
  recentTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  recentDetail: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  recentAction: {
    color: colors.accentBlue,
    fontSize: 12,
    fontWeight: '900',
  },
  emptyState: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.78,
  },
});

