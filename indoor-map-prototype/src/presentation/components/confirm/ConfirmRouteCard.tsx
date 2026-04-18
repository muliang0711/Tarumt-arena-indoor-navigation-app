import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import type { DestinationAnchor, RouteModel } from '../../../shared/types';
import { colors, radii, spacing } from '../../../shared/theme/tokens';

type ConfirmActionId = 'choose-another' | 'start-navigation';

interface ConfirmRouteCardProps {
  buildingName: string;
  currentLocationLabel: string;
  floorLabel: string;
  route: RouteModel | null;
  selectedDestination: DestinationAnchor | null;
  onChooseAnother: () => void;
  onOpenMap: () => void;
}

export function ConfirmRouteCard({
  buildingName,
  currentLocationLabel,
  floorLabel,
  route,
  selectedDestination,
  onChooseAnother,
  onOpenMap,
}: ConfirmRouteCardProps) {
  const [activeAction, setActiveAction] = useState<ConfirmActionId | null>('start-navigation');
  const chooseAnotherProgress = useRef(new Animated.Value(0)).current;
  const startNavigationProgress = useRef(new Animated.Value(0)).current;
  const helperProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(chooseAnotherProgress, {
        toValue: activeAction === 'choose-another' ? 1 : 0,
        damping: 16,
        stiffness: 180,
        mass: 0.9,
        useNativeDriver: false,
      }),
      Animated.spring(startNavigationProgress, {
        toValue: activeAction === 'start-navigation' ? 1 : 0,
        damping: 16,
        stiffness: 180,
        mass: 0.9,
        useNativeDriver: false,
      }),
      Animated.timing(helperProgress, {
        toValue: activeAction ? 1 : 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeAction, chooseAnotherProgress, helperProgress, startNavigationProgress]);

  function handleActionPress(actionId: ConfirmActionId) {
    if (activeAction === actionId) {
      if (actionId === 'choose-another') {
        onChooseAnother();
        return;
      }

      onOpenMap();
      return;
    }

    setActiveAction(actionId);
  }

  const activeActionTitle =
    activeAction === 'choose-another' ? 'Choose another route' : 'Start navigate';

  return (
    <View style={styles.confirmCard}>
      <Text style={styles.confirmLabel}>Destination</Text>
      <Text style={styles.confirmTitle}>{selectedDestination?.label ?? 'Unknown'}</Text>
      <Text style={styles.confirmSubtitle}>{selectedDestination?.subtitle ?? ''}</Text>

      <View style={styles.confirmDivider} />

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>From</Text>
        <Text style={styles.infoValue}>{currentLocationLabel}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Building</Text>
        <Text style={styles.infoValue}>{buildingName}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Floor</Text>
        <Text style={styles.infoValue}>{floorLabel}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Estimated walk</Text>
        <Text style={styles.infoValue}>
          {route?.distanceMeters ?? 0} m / {route?.etaMinutes ?? 0} min
        </Text>
      </View>

      <View style={styles.actionRow}>
        <ConfirmActionButton
          icon={<ChooseAnotherGlyph active={activeAction === 'choose-another'} />}
          title="Choose another route"
          accentColor={colors.accentAmber}
          accentBackground={colors.accentAmberSoft}
          progress={chooseAnotherProgress}
          onPress={() => handleActionPress('choose-another')}
        />
        <ConfirmActionButton
          icon={<StartNavigateGlyph active={activeAction === 'start-navigation'} />}
          title="Start navigate"
          accentColor={colors.accentBlue}
          accentBackground={colors.accentBlueSoft}
          progress={startNavigationProgress}
          onPress={() => handleActionPress('start-navigation')}
        />
      </View>

      <Animated.View
        pointerEvents={activeAction ? 'auto' : 'none'}
        style={[
          styles.actionHelper,
          {
            opacity: helperProgress,
            transform: [
              {
                translateY: helperProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.actionHelperTitle}>{activeActionTitle}</Text>
        <Text style={styles.actionHelperHint}>Tap the highlighted control again to continue.</Text>
      </Animated.View>
    </View>
  );
}

function ConfirmActionButton({
  icon,
  title,
  accentColor,
  accentBackground,
  progress,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  accentColor: string;
  accentBackground: string;
  progress: Animated.Value;
  onPress: () => void;
}) {
  const animatedBorderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, accentColor],
  });

  const animatedBackgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.white, accentBackground],
  });

  const animatedScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03],
  });

  const animatedIconTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });

  return (
    <Animated.View
      style={[
        styles.actionButtonShell,
        {
          borderColor: animatedBorderColor,
          backgroundColor: animatedBackgroundColor,
          transform: [{ scale: animatedScale }],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.actionButtonPressable, pressed && styles.actionButtonPressed]}
      >
        <Animated.View style={{ transform: [{ translateY: animatedIconTranslateY }] }}>
          {icon}
        </Animated.View>
        <Animated.Text
          numberOfLines={1}
          style={[
            styles.actionButtonLabel,
            {
              color: accentColor,
              maxHeight: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 20],
              }),
              opacity: progress.interpolate({
                inputRange: [0, 0.45, 1],
                outputRange: [0, 0.16, 1],
              }),
            },
          ]}
        >
          {title}
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

function ChooseAnotherGlyph({ active }: { active: boolean }) {
  return (
    <View style={styles.glyphFrame}>
      <View style={[styles.chooseGlyphArrow, active && styles.chooseGlyphArrowActive]} />
      <View style={[styles.chooseGlyphStem, active && styles.chooseGlyphStemActive]} />
      <View style={[styles.chooseGlyphDot, active && styles.chooseGlyphDotActive]} />
    </View>
  );
}

function StartNavigateGlyph({ active }: { active: boolean }) {
  return (
    <View style={styles.glyphFrame}>
      <View style={[styles.navigateGlyphArrow, active && styles.navigateGlyphArrowActive]} />
      <View style={[styles.navigateGlyphTail, active && styles.navigateGlyphTailActive]} />
    </View>
  );
}

const styles = StyleSheet.create({
  confirmCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.glassStroke,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 12,
    gap: spacing.md,
  },
  confirmLabel: {
    color: colors.accentBlue,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  confirmTitle: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  confirmSubtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  confirmDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  infoValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionButtonShell: {
    flex: 1,
    minHeight: 88,
    borderRadius: radii.md,
    borderWidth: 1,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 6,
  },
  actionButtonPressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  actionButtonPressed: {
    opacity: 0.92,
  },
  actionButtonLabel: {
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
  },
  actionHelper: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderWidth: 1,
    borderColor: colors.glassStroke,
    gap: spacing.xs,
  },
  actionHelperTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  actionHelperHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  glyphFrame: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  chooseGlyphArrow: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderLeftWidth: 2.2,
    borderBottomWidth: 2.2,
    borderColor: colors.accentAmber,
    left: 4,
    top: 5,
    transform: [{ rotate: '45deg' }],
  },
  chooseGlyphArrowActive: {
    borderColor: colors.textPrimary,
  },
  chooseGlyphStem: {
    position: 'absolute',
    width: 11,
    height: 2.2,
    borderRadius: radii.pill,
    backgroundColor: colors.accentAmber,
    right: 4,
    bottom: 8,
  },
  chooseGlyphStemActive: {
    backgroundColor: colors.textPrimary,
  },
  chooseGlyphDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.accentAmber,
    right: 4,
    top: 5,
  },
  chooseGlyphDotActive: {
    backgroundColor: colors.textPrimary,
  },
  navigateGlyphArrow: {
    width: 13,
    height: 13,
    borderTopWidth: 2.2,
    borderRightWidth: 2.2,
    borderColor: colors.accentBlue,
    transform: [{ rotate: '45deg' }],
    marginTop: 2,
  },
  navigateGlyphArrowActive: {
    borderColor: colors.textPrimary,
  },
  navigateGlyphTail: {
    position: 'absolute',
    width: 14,
    height: 2.2,
    borderRadius: radii.pill,
    backgroundColor: colors.accentBlue,
    transform: [{ rotate: '-45deg' }],
    left: 4,
    bottom: 7,
  },
  navigateGlyphTailActive: {
    backgroundColor: colors.textPrimary,
  },
});
