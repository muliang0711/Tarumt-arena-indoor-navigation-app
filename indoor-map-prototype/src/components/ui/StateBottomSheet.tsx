import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, radii, spacing } from '../../theme/tokens';
import type { DestinationAnchor, FlowState, RouteModel } from '../../types';

interface StateBottomSheetProps {
  state: FlowState;
  buildingName: string;
  floorLabel: string;
  currentLocationLabel: string;
  selectedDestination: DestinationAnchor | null;
  destinations: DestinationAnchor[];
  route: RouteModel | null;
  onConfirmIndoor: () => void;
  onStartNavigation: () => void;
  onSelectDestination: (destinationId: string) => void;
  onRestart: () => void;
  onEndNavigation: () => void;
}

function PrimaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.primaryButton}>
      <Text style={styles.primaryButtonLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function SecondaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={styles.secondaryButton}>
      <Text style={styles.secondaryButtonLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function StateBottomSheet({
  state,
  buildingName,
  floorLabel,
  currentLocationLabel,
  selectedDestination,
  destinations,
  route,
  onConfirmIndoor,
  onStartNavigation,
  onSelectDestination,
  onRestart,
  onEndNavigation,
}: StateBottomSheetProps) {
  const titleByState: Record<FlowState, string> = {
    detected: 'Indoor signal locked',
    confirmed: 'Location confirmed',
    navigating: `Navigating to ${selectedDestination?.label ?? 'destination'}`,
    arrived: 'You have arrived',
  };

  const subtitleByState: Record<FlowState, string> = {
    detected: `Detected inside ${buildingName} on ${floorLabel}.`,
    confirmed: `Ready to launch a route from ${currentLocationLabel}.`,
    navigating: route?.instruction ?? 'Follow the indoor route overlay on the map.',
    arrived: `${selectedDestination?.label ?? 'Destination'} reached on ${floorLabel}.`,
  };

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <View style={styles.sheet}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{titleByState[state]}</Text>
            <Text style={styles.subtitle}>{subtitleByState[state]}</Text>
          </View>
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeLabel}>Indoor first</Text>
          </View>
        </View>

        <View style={styles.contextCard}>
          <View style={styles.contextItem}>
            <Text style={styles.contextLabel}>Building</Text>
            <Text style={styles.contextValue}>{buildingName}</Text>
          </View>
          <View style={styles.contextItem}>
            <Text style={styles.contextLabel}>Floor</Text>
            <Text style={styles.contextValue}>{floorLabel}</Text>
          </View>
          <View style={styles.contextItem}>
            <Text style={styles.contextLabel}>Anchor</Text>
            <Text style={styles.contextValue}>{currentLocationLabel}</Text>
          </View>
        </View>

        {(state === 'confirmed' || state === 'navigating' || state === 'arrived') && (
          <View style={styles.destinationsBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Destinations</Text>
              {route ? (
                <Text style={styles.sectionMeta}>
                  {route.distanceMeters} m · {route.etaMinutes} min
                </Text>
              ) : null}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.destinationRail}>
              {destinations.map((destination) => {
                const isSelected = selectedDestination?.id === destination.id;
                return (
                  <TouchableOpacity
                    key={destination.id}
                    activeOpacity={0.88}
                    onPress={() => onSelectDestination(destination.id)}
                    style={[
                      styles.destinationChip,
                      isSelected && {
                        borderColor: destination.accentColor,
                        backgroundColor: `${destination.accentColor}18`,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.destinationSwatch,
                        { backgroundColor: destination.accentColor },
                      ]}
                    />
                    <View>
                      <Text style={styles.destinationLabel}>{destination.label}</Text>
                      <Text style={styles.destinationSubtitle}>{destination.subtitle}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {selectedDestination && (state === 'confirmed' || state === 'navigating' || state === 'arrived') ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Selected room</Text>
            <Text style={styles.summaryTitle}>{selectedDestination.label}</Text>
            <Text style={styles.summaryText}>{selectedDestination.subtitle}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {state === 'detected' ? <PrimaryButton label="Confirm location" onPress={onConfirmIndoor} /> : null}
          {state === 'confirmed' ? <PrimaryButton label="Start indoor route" onPress={onStartNavigation} /> : null}
          {state === 'navigating' ? <SecondaryButton label="Reset route" onPress={onRestart} /> : null}
          {state === 'arrived' ? (
            <>
              <PrimaryButton label="Start new route" onPress={onRestart} />
              <SecondaryButton label="End navigation" onPress={onEndNavigation} />
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 12,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    maxWidth: 250,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accentGreenSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.accentGreen,
  },
  badgeLabel: {
    color: colors.accentGreen,
    fontSize: 12,
    fontWeight: '700',
  },
  contextCard: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  contextItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  contextLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  contextValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  destinationsBlock: {
    gap: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  destinationRail: {
    gap: spacing.sm,
    paddingRight: spacing.xs,
  },
  destinationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceStrong,
    minWidth: 170,
  },
  destinationSwatch: {
    width: 12,
    height: 12,
    borderRadius: radii.pill,
  },
  destinationLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  destinationSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: colors.accentBlueSoft,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  summaryLabel: {
    color: colors.accentBlue,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  summaryText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  actions: {
    gap: spacing.sm,
  },
  primaryButton: {
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    color: colors.textOnDark,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    height: 50,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
