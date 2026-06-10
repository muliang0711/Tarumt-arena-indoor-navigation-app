import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { DestinationAnchor, DestinationFloorCatalog } from '../../../shared/types';
import { colors, radii, spacing } from '../../../shared/theme/tokens';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { HeaderSystemRow } from '../../components/shared/HeaderSystemRow';
import { DashboardBottomNavigation } from '../../components/shared/DashboardBottomNavigation';
import { DashboardFloorPlanBackground } from '../../components/shared/DashboardFloorPlanBackground';
import { DashboardGlassPanel } from '../../components/shared/DashboardGlassPanel';
import { RouteIcon } from '../../components/shared/DashboardIcons';
import { DashboardSearchField } from '../../components/shared/DashboardSearchField';

interface DestinationFloorRoomsStepProps {
  floor: DestinationFloorCatalog;
  selectedDestinationId: string | null;
  onBack: () => void;
  onOpenMapOverview: () => void;
  onGoHome?: () => void;
  onSelectDestination: (destinationId: string) => void;
  onContinue: () => void;
}

const filters = ['All', 'Studios', 'Labs', 'Offices', 'Facilities'];

export function DestinationFloorRoomsStep({
  floor,
  selectedDestinationId,
  onBack,
  onOpenMapOverview,
  onGoHome,
  onSelectDestination,
  onContinue,
}: DestinationFloorRoomsStepProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const allRooms = useMemo(
    () =>
      floor.categories.flatMap((category) =>
        category.rooms.map((room, index) => ({
          room,
          categoryLabel: category.label,
          categoryIndex: floor.categories.findIndex((candidate) => candidate.id === category.id),
          roomIndex: index,
        }))
      ),
    [floor.categories]
  );

  const visibleRooms = useMemo(() => {
    return allRooms.filter(({ room, categoryLabel }) => {
      const haystack = [room.label, room.subtitle, categoryLabel, room.categoryLabel]
        .join(' ')
        .toLowerCase();
      const matchesSearch = !normalizedQuery || haystack.includes(normalizedQuery);
      const matchesFilter =
        activeFilter === 'All' ||
        haystack.includes(activeFilter.toLowerCase().replace(/s$/, ''));

      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, allRooms, normalizedQuery]);

  const selectedRoom =
    allRooms.find(({ room }) => room.id === selectedDestinationId)?.room ?? allRooms[0]?.room ?? null;

  function handleContinue() {
    if (!selectedRoom) {
      return;
    }

    onSelectDestination(selectedRoom.id);
    requestAnimationFrame(() => {
      onContinue();
    });
  }

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
                <Text style={styles.title}>Choose a room</Text>
                <Text style={styles.subtitle}>
                  {floor.buildingName} · {floor.label} · {floor.roomCount} mapped rooms
                </Text>
              </View>
              <View style={styles.floorBadge}>
                <Text style={styles.floorBadgeLabel}>Floor</Text>
                <Text style={styles.floorBadgeValue}>
                  {floor.label === 'Ground Floor' ? 'G' : floor.label[0]}
                </Text>
              </View>
            </View>
          </View>

          <DashboardSearchField
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={`Search rooms, offices, toilets on ${floor.label}...`}
          />

          <View style={styles.sectionBlock}>
            <Text style={styles.blockTitle}>Room Type</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterList}
            >
              {filters.map((filter) => {
                const active = filter === activeFilter;
                return (
                  <Pressable
                    key={filter}
                    accessibilityRole="button"
                    onPress={() => setActiveFilter(filter)}
                    style={({ pressed }) => [
                      styles.filterChip,
                      active && styles.filterChipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {filter}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <DashboardGlassPanel contentStyle={styles.summaryCard}>
            <View>
              <Text style={styles.cardEyebrow}>Selected Floor</Text>
              <Text style={styles.summaryTitle}>{floor.label}</Text>
              <Text style={styles.summaryDetail}>
                {floor.categories.length} categories · closest route starts at West Entrance Lobby
              </Text>
            </View>
            <View style={styles.summaryMetric}>
              <Text style={styles.summaryMetricValue}>{visibleRooms.length}</Text>
              <Text style={styles.summaryMetricLabel}>shown</Text>
            </View>
          </DashboardGlassPanel>

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.blockTitle}>Available Rooms</Text>
              <Text style={styles.sectionMeta}>{visibleRooms.length} matches</Text>
            </View>
            <View style={styles.roomList}>
              {visibleRooms.map(({ room, categoryLabel, categoryIndex, roomIndex }) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  categoryLabel={categoryLabel}
                  index={categoryIndex * 3 + roomIndex}
                  selected={room.id === selectedDestinationId}
                  onPress={() => onSelectDestination(room.id)}
                />
              ))}
              {!visibleRooms.length ? (
                <DashboardGlassPanel contentStyle={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No rooms found</Text>
                  <Text style={styles.emptyText}>Try All, a category name, or a specific room code.</Text>
                </DashboardGlassPanel>
              ) : null}
            </View>
          </View>

          <DashboardGlassPanel contentStyle={styles.continueCard}>
            <View style={styles.continueCopy}>
              <Text style={styles.continueTitle}>{selectedRoom?.label ?? 'Select a room'}</Text>
              <Text style={styles.continueDetail}>
                {selectedRoom
                  ? `${selectedRoom.subtitle} · ${selectedRoom.categoryLabel ?? 'Room'}`
                  : 'Choose a destination to continue.'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={!selectedRoom}
              onPress={handleContinue}
              style={({ pressed }) => [
                styles.primaryButton,
                !selectedRoom && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <RouteIcon color={colors.white} />
              <Text style={styles.primaryButtonText}>Confirm Room</Text>
            </Pressable>
          </DashboardGlassPanel>
        </ScrollView>

        <DashboardBottomNavigation
          activeTabId="search"
          onHomePress={onGoHome ?? onBack}
          onSearchPress={onBack}
          onMapPress={onOpenMapOverview}
        />
      </View>
    </ScreenShell>
  );
}

function RoomCard({
  room,
  categoryLabel,
  index,
  selected,
  onPress,
}: {
  room: DestinationAnchor;
  categoryLabel: string;
  index: number;
  selected: boolean;
  onPress: () => void;
}) {
  const distanceMeters = 42 + index * 17;
  const walkMinutes = Math.max(2, Math.ceil(distanceMeters / 34));
  const nearLabel = distanceMeters < 80 ? 'Nearby' : 'Mapped route';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.roomCard,
        selected && styles.roomCardSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.roomAccent, { backgroundColor: room.accentColor }]} />
      <View style={styles.roomCopy}>
        <View style={styles.roomTitleRow}>
          <Text style={styles.roomTitle}>{room.label}</Text>
          <Text style={[styles.roomState, selected && styles.roomStateSelected]}>
            {selected ? 'Selected' : nearLabel}
          </Text>
        </View>
        <Text style={styles.roomSubtitle}>{room.subtitle}</Text>
        <View style={styles.roomMetaRow}>
          <Text style={styles.roomMeta}>{categoryLabel}</Text>
          <Text style={styles.roomMeta}>{walkMinutes} min walk</Text>
          <Text style={styles.roomMeta}>{distanceMeters}m</Text>
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
  floorBadge: {
    width: 58,
    borderRadius: radii.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.accentBlueSoft,
    borderWidth: 1,
    borderColor: 'rgba(47, 107, 255, 0.18)',
    alignItems: 'center',
  },
  floorBadgeLabel: {
    color: colors.accentBlue,
    fontSize: 10,
    fontWeight: '900',
  },
  floorBadgeValue: {
    color: colors.accentBlue,
    fontSize: 20,
    fontWeight: '900',
  },
  sectionBlock: {
    gap: spacing.sm,
  },
  blockTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  filterList: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  filterChip: {
    minHeight: 38,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.84)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: colors.accentBlueSoft,
    borderColor: 'rgba(47, 107, 255, 0.24)',
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  filterChipTextActive: {
    color: colors.accentBlue,
  },
  summaryCard: {
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardEyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  summaryTitle: {
    marginTop: 4,
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  summaryDetail: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  summaryMetric: {
    minWidth: 68,
    borderRadius: radii.sm,
    padding: spacing.sm,
    backgroundColor: 'rgba(248, 250, 252, 0.84)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  summaryMetricValue: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
  },
  summaryMetricLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  roomList: {
    gap: spacing.sm,
  },
  roomCard: {
    flexDirection: 'row',
    gap: spacing.md,
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
  roomCardSelected: {
    borderColor: 'rgba(47, 107, 255, 0.44)',
    backgroundColor: 'rgba(234, 242, 255, 0.9)',
  },
  roomAccent: {
    width: 7,
    alignSelf: 'stretch',
    borderRadius: radii.pill,
  },
  roomCopy: {
    flex: 1,
    gap: 4,
  },
  roomTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  roomTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
  roomState: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '900',
  },
  roomStateSelected: {
    color: colors.accentBlue,
  },
  roomSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  roomMetaRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  roomMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  continueCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  continueCopy: {
    gap: 2,
  },
  continueTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
  continueDetail: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.accentBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.45,
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

