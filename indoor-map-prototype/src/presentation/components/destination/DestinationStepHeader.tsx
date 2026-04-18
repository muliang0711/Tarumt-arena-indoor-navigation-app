import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { colors, radii, spacing } from '../../../shared/theme/tokens';
import { HeaderSystemRow } from '../layout/HeaderSystemRow';

interface DestinationStepHeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
}

export function DestinationStepHeader({
  query,
  onQueryChange,
}: DestinationStepHeaderProps) {
  const [isActive, setIsActive] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const progress = useRef(new Animated.Value(query ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: isActive ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [isActive, progress]);

  function openSearch() {
    if (!isActive) {
      setIsActive(true);
      setTimeout(() => inputRef.current?.focus(), 120);
      return;
    }

    inputRef.current?.focus();
  }

  function closeSearchIfEmpty() {
    if (!query.trim()) {
      setIsActive(false);
    }
  }

  const promptOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const inputOpacity = progress.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 0.2, 1],
  });
  const inputTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 0],
  });
  const barBackgroundOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.62, 0.92],
  });

  function handleTrackLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  const collapsedWidth = 38;
  const expandedWidth = trackWidth || collapsedWidth;
  const inputWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [collapsedWidth, expandedWidth],
  });
  const inputLeft = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [Math.max((trackWidth || collapsedWidth) - collapsedWidth, 0), 0],
  });

  return (
    <View style={styles.pageHeader}>
      <HeaderSystemRow style={styles.systemRow} />

      <Text style={styles.pageTitle}>Where you want to go?</Text>

      <View style={styles.searchShell}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.searchGlassFill,
            {
              opacity: barBackgroundOpacity,
            },
          ]}
        />
        <View pointerEvents="none" style={styles.searchGlassStroke} />

        <View onLayout={handleTrackLayout} style={styles.searchTrack}>
          <Animated.View
            style={[
              styles.promptRow,
              {
                opacity: promptOpacity,
              },
            ]}
          >
            <View style={styles.promptTextWrap}>
              <Text style={styles.promptText}>
                Search buildings, rooms, facilities, or destinations. Example: TA201
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={openSearch}
              style={styles.searchIconButton}
            >
              <View style={styles.searchIconWrap}>
                <View style={styles.searchIconLens} />
                <View style={styles.searchIconHandle} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View
            style={[
              styles.inputWrap,
              {
                left: inputLeft,
                width: inputWidth,
                opacity: inputOpacity,
                transform: [{ translateY: inputTranslateY }],
              },
            ]}
          >
            <View style={styles.searchInputShell}>
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={onQueryChange}
                onFocus={() => setIsActive(true)}
                onBlur={closeSearchIfEmpty}
                placeholder="Search destination, room, or facility"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.accentBlue}
                style={styles.searchInput}
              />
            </View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  systemRow: {
    marginBottom: spacing.sm,
  },
  pageTitle: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
  },
  searchShell: {
    position: 'relative',
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.46)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 26,
    elevation: 12,
  },
  searchTrack: {
    position: 'relative',
    minHeight: 40,
    justifyContent: 'center',
  },
  searchGlassFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(244, 247, 252, 0.72)',
  },
  searchGlassStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  promptTextWrap: {
    flex: 1,
    paddingRight: spacing.xs,
  },
  promptText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  searchIconButton: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIconLens: {
    width: 14,
    height: 14,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.accentBlue,
  },
  searchIconHandle: {
    position: 'absolute',
    width: 8,
    height: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.accentBlue,
    right: 1,
    bottom: 2,
    transform: [{ rotate: '45deg' }],
  },
  inputWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  searchInputShell: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 0,
  },
});
