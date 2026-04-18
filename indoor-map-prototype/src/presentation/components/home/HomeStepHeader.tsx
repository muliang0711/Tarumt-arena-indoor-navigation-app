import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../../shared/theme/tokens';
import { HeaderSystemRow } from '../layout/HeaderSystemRow';

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
      <HeaderSystemRow style={styles.systemRow} />
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
    marginBottom: spacing.lg,
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
    fontFamily: 'Orbitron_800ExtraBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
