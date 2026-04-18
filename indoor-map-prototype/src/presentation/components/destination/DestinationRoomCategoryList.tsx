import React, { useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { DestinationFloorCatalog } from '../../../shared/types';
import { colors, radii, spacing } from '../../../shared/theme/tokens';

interface DestinationRoomCategoryListProps {
  floor: DestinationFloorCatalog;
  selectedDestinationId: string | null;
  onSelectDestination: (destinationId: string) => void;
  onConfirmDestination: (destinationId: string) => void;
}

export function DestinationRoomCategoryList({
  floor,
  selectedDestinationId,
  onSelectDestination,
  onConfirmDestination,
}: DestinationRoomCategoryListProps) {
  const lastTapRef = useRef<{ destinationId: string; timestamp: number } | null>(null);

  function handleRoomPress(destinationId: string) {
    const now = Date.now();
    const previousTap = lastTapRef.current;

    if (
      previousTap &&
      previousTap.destinationId === destinationId &&
      now - previousTap.timestamp < 320
    ) {
      onSelectDestination(destinationId);
      onConfirmDestination(destinationId);
      lastTapRef.current = null;
      return;
    }

    lastTapRef.current = { destinationId, timestamp: now };
    onSelectDestination(destinationId);
  }

  return (
    <ScrollView contentContainerStyle={styles.categoryList}>
      {floor.categories.map((category) => (
        <View key={category.id} style={styles.categorySection}>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryTitle}>{category.label}</Text>
            <Text style={styles.categoryMeta}>{category.rooms.length} rooms</Text>
          </View>

          <View style={styles.roomStack}>
            {category.rooms.map((room) => {
              const selected = room.id === selectedDestinationId;
              return (
                <TouchableOpacity
                  key={room.id}
                  activeOpacity={0.9}
                  onPress={() => handleRoomPress(room.id)}
                  style={[
                    styles.roomCard,
                    selected && {
                      borderColor: room.accentColor,
                      backgroundColor: `${room.accentColor}14`,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.roomAccent,
                      { backgroundColor: room.accentColor },
                    ]}
                  />
                  <View style={styles.roomTextBlock}>
                    <Text style={styles.roomTitle}>{room.label}</Text>
                    <Text style={styles.roomMeta}>{room.subtitle}</Text>
                    <Text style={styles.roomHint}>Double tap to continue</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  categoryList: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  categorySection: {
    backgroundColor: 'rgba(244, 247, 252, 0.42)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.glassStroke,
    padding: spacing.md,
    gap: spacing.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  categoryTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  categoryMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  roomStack: {
    gap: spacing.sm,
  },
  roomCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.glassStroke,
    padding: spacing.md,
  },
  roomAccent: {
    width: 12,
    alignSelf: 'stretch',
    borderRadius: radii.pill,
  },
  roomTextBlock: {
    flex: 1,
    gap: 4,
  },
  roomTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  roomMeta: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  roomHint: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
});
