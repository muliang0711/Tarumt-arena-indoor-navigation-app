import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { FloorOption } from '../../../shared/types';
import { colors, radii, spacing } from '../../../shared/theme/tokens';

interface MapOverviewTopPanelProps {
  activeFloorId: string;
  floors: FloorOption[];
  onSelectFloor: (floorId: string) => void;
}

export function MapOverviewTopPanel({
  activeFloorId,
  floors,
  onSelectFloor,
}: MapOverviewTopPanelProps) {
  const activeFloor = floors.find((floor) => floor.id === activeFloorId) ?? floors[0] ?? null;

  return (
    <View style={styles.wrap}>
      <View style={styles.panel}>
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>Overview map</Text>
            <Text style={styles.title}>{activeFloor?.label ?? 'Unknown'}</Text>
          </View>
          <Text style={styles.hint}>Swipe to see floors</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.floorRow}
        >
          {floors.map((floor) => {
            const active = floor.id === activeFloorId;

            return (
              <Pressable
                key={floor.id}
                onPress={() => onSelectFloor(floor.id)}
                style={({ pressed }) => [
                  styles.floorChip,
                  active && styles.floorChipActive,
                  floor.availability === 'preview' && styles.floorChipPreview,
                  pressed && styles.floorChipPressed,
                ]}
              >
                <Text
                  style={[
                    styles.floorChipLabel,
                    active && styles.floorChipLabelActive,
                    floor.availability === 'preview' && styles.floorChipLabelPreview,
                  ]}
                >
                  {floor.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  panel: {
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(14, 24, 38, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleBlock: {
    flex: 1,
  },
  eyebrow: {
    color: 'rgba(248, 250, 253, 0.58)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  title: {
    color: colors.textOnDark,
    fontSize: 20,
    fontWeight: '800',
  },
  hint: {
    color: 'rgba(248, 250, 253, 0.58)',
    fontSize: 11,
    fontWeight: '700',
    paddingBottom: 3,
  },
  floorRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    paddingRight: spacing.lg,
  },
  floorChip: {
    minHeight: 38,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248, 250, 253, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  floorChipActive: {
    backgroundColor: colors.white,
    borderColor: colors.white,
  },
  floorChipPreview: {
    opacity: 0.75,
  },
  floorChipPressed: {
    opacity: 0.9,
  },
  floorChipLabel: {
    color: colors.textOnDark,
    fontSize: 13,
    fontWeight: '700',
  },
  floorChipLabelActive: {
    color: colors.textPrimary,
  },
  floorChipLabelPreview: {
    color: 'rgba(248, 250, 253, 0.76)',
  },
});
