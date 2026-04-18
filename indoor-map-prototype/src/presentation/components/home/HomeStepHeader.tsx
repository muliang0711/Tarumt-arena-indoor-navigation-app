import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../../shared/theme/tokens';

interface HomeStepHeaderProps {
  title: string;
}

export function HomeStepHeader({ title }: HomeStepHeaderProps) {
  const [campusWord = '', navigatorWord = ''] = title.toUpperCase().split(' ');
  const campusChars = [...campusWord];
  const navigatorChars = [...navigatorWord];
  const totalChars = campusChars.length + navigatorChars.length;
  const charAnimations = useRef<Animated.Value[]>(
    Array.from({ length: totalChars }, () => new Animated.Value(0))
  );

  if (charAnimations.current.length !== totalChars) {
    charAnimations.current = Array.from({ length: totalChars }, () => new Animated.Value(0));
  }

  useEffect(() => {
    const animations = charAnimations.current;

    animations.forEach((animation) => animation.setValue(0));

    const campusReveal = Animated.stagger(
      140,
      animations.slice(0, campusChars.length).map((animation) =>
        Animated.timing(animation, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    );

    const navigatorReveal = Animated.stagger(
      130,
      animations.slice(campusChars.length).map((animation) =>
        Animated.timing(animation, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    );

    Animated.sequence([campusReveal, Animated.delay(220), navigatorReveal]).start();

    return () => {
      animations.forEach((animation) => animation.stopAnimation());
    };
  }, [campusChars.length, navigatorChars.length]);

  return (
    <View style={styles.pageHeader}>
      <View style={styles.systemRow}>
        <Text style={styles.timeText}>07:23 PM</Text>
        <View style={styles.systemChip}>
          <View style={styles.systemChipDot} />
          <Text style={styles.systemChipLabel}>System Active</Text>
        </View>
      </View>
      <View style={styles.titleRow}>
        {campusChars.map((char, index) => {
          const animation = charAnimations.current[index];
          const translateY = animation.interpolate({
            inputRange: [0, 1],
            outputRange: [8, 0],
          });
          const letterSpacingScale = animation.interpolate({
            inputRange: [0, 1],
            outputRange: [0.94, 1],
          });

          return (
            <Animated.View
              key={`campus-${char}-${index}`}
              style={[
                styles.charWrap,
                {
                  opacity: animation,
                  transform: [{ translateY }, { scale: letterSpacingScale }],
                },
              ]}
            >
              <Text style={styles.pageTitle}>{char}</Text>
            </Animated.View>
          );
        })}

        <View style={styles.wordGap} />

        {navigatorChars.map((char, index) => {
          const animation = charAnimations.current[campusChars.length + index];
          const translateY = animation.interpolate({
            inputRange: [0, 1],
            outputRange: [8, 0],
          });
          const letterSpacingScale = animation.interpolate({
            inputRange: [0, 1],
            outputRange: [0.94, 1],
          });

          return (
            <Animated.View
              key={`navigator-${char}-${index}`}
              style={[
                styles.charWrap,
                {
                  opacity: animation,
                  transform: [{ translateY }, { scale: letterSpacingScale }],
                },
              ]}
            >
              <Text style={styles.pageTitle}>{char}</Text>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  systemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  timeText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  systemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accentGreenSoft,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  systemChipDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.accentGreen,
  },
  systemChipLabel: {
    color: colors.accentGreen,
    fontSize: 12,
    fontWeight: '700',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  charWrap: {
    overflow: 'visible',
  },
  wordGap: {
    width: 12,
  },
  pageTitle: {
    color: colors.textPrimary,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
