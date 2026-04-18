import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';

import { colors, radii, spacing } from '../../../shared/theme/tokens';

type DockItemId = 'home' | 'start' | 'map';

interface ActionDockProps {
  onHomePress?: () => void;
  onStartPress: () => void;
  onMapPress?: () => void;
}

interface DockItemConfig {
  id: DockItemId;
  label: string;
  icon: DockItemId;
  onPress: () => void;
}

export function ActionDock({
  onHomePress = () => {},
  onStartPress,
  onMapPress = () => {},
}: ActionDockProps) {
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const items: DockItemConfig[] = [
    { id: 'home', label: 'Home', icon: 'home', onPress: onHomePress },
    { id: 'start', label: 'Start', icon: 'start', onPress: onStartPress },
    { id: 'map', label: 'Map', icon: 'map', onPress: onMapPress },
  ];

  function handlePress(item: DockItemConfig) {
    if (activeItemId === item.id) {
      item.onPress();
      return;
    }

    setActiveItemId(item.id);
  }

  return (
    <View style={styles.wrap}>
      <View pointerEvents="none" style={styles.shadowBase} />

      <View style={styles.dock}>
        <BlurView
          tint="light"
          intensity={70}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFillObject}
        />
        <View pointerEvents="none" style={styles.dockWash} />
        <View pointerEvents="none" style={styles.dockHighlight} />
        <View pointerEvents="none" style={styles.dockStroke} />

        {items.map((item) => (
          <DockItem
            key={item.id}
            active={activeItemId === item.id}
            label={item.label}
            onPress={() => handlePress(item)}
            icon={<DockGlyph icon={item.icon} active={activeItemId === item.id} />}
          />
        ))}
      </View>
    </View>
  );
}

function DockItem({
  active,
  label,
  onPress,
  icon,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  icon: React.ReactNode;
}) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [active, progress]);

  const animatedWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [58, 122],
  });

  const animatedLabelWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 58],
  });

  const animatedLabelOpacity = progress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0, 0.12, 1],
  });

  const animatedLabelTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 0],
  });

  return (
    <Animated.View style={[styles.dockItem, { width: animatedWidth }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.dockItemActiveFill, { opacity: progress }]}
      />
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.dockItemPressable, pressed && styles.dockItemPressed]}
      >
        <View style={styles.dockItemIconWrap}>{icon}</View>
        <Animated.View
          style={[
            styles.dockItemLabelWrap,
            {
              width: animatedLabelWidth,
              opacity: animatedLabelOpacity,
              transform: [{ translateY: animatedLabelTranslateY }],
            },
          ]}
        >
          <Text style={styles.dockItemLabel} numberOfLines={1}>
            {label}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function DockGlyph({ icon, active }: { icon: DockItemId; active: boolean }) {
  if (icon === 'home') {
    return (
      <View style={styles.glyphBox}>
        <View style={[styles.homeGlyphRoof, active && styles.glyphLineActive]} />
        <View style={[styles.homeGlyphBody, active && styles.glyphBorderActive]} />
      </View>
    );
  }

  if (icon === 'start') {
    return (
      <View style={styles.glyphBox}>
        <View style={[styles.startGlyphDiamond, active && styles.glyphBorderActive]} />
        <View style={[styles.startGlyphTail, active && styles.glyphLineActive]} />
      </View>
    );
  }

  if (icon === 'map') {
    return (
      <View style={styles.mapGlyphWrap}>
        <View style={[styles.mapGlyphPanel, active && styles.glyphBorderActive]} />
        <View style={[styles.mapGlyphFold, active && styles.glyphBorderActive]} />
        <View
          style={[
            styles.mapGlyphFold,
            styles.mapGlyphFoldRight,
            active && styles.glyphBorderActive,
          ]}
        />
      </View>
    );
  }

  return (
    <View style={styles.glyphBox}>
      <View style={[styles.startGlyphDiamond, active && styles.glyphBorderActive]} />
      <View style={[styles.startGlyphTail, active && styles.glyphLineActive]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  shadowBase: {
    position: 'absolute',
    bottom: -8,
    width: '74%',
    height: 82,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    shadowColor: 'rgba(15, 23, 42, 0.28)',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 14,
  },
  dock: {
    position: 'relative',
    width: '94%',
    minHeight: 74,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(232, 238, 247, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.42)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  dockWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  dockHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '46%',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  dockStroke: {
    position: 'absolute',
    inset: 1,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  dockItem: {
    height: 58,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(244, 247, 252, 0.16)',
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
  },
  dockItemActiveFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(244, 247, 252, 0.9)',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.76)',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 10,
  },
  dockItemPressable: {
    flex: 1,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dockItemPressed: {
    opacity: 0.92,
  },
  dockItemIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockItemLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  dockItemLabelWrap: {
    overflow: 'hidden',
  },
  glyphBox: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glyphLineActive: {
    backgroundColor: colors.accentBlue,
  },
  glyphBorderActive: {
    borderColor: colors.accentBlue,
  },
  homeGlyphRoof: {
    position: 'absolute',
    top: 3,
    width: 11,
    height: 11,
    borderTopWidth: 1.8,
    borderRightWidth: 1.8,
    borderColor: colors.textSecondary,
    transform: [{ rotate: '-45deg' }],
  },
  homeGlyphBody: {
    position: 'absolute',
    top: 8,
    width: 11,
    height: 8,
    borderWidth: 1.8,
    borderTopWidth: 0,
    borderColor: colors.textSecondary,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  startGlyphDiamond: {
    width: 10,
    height: 10,
    borderWidth: 1.8,
    borderColor: colors.textSecondary,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  startGlyphTail: {
    position: 'absolute',
    width: 8,
    height: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.textSecondary,
    right: 2,
    bottom: 4,
    transform: [{ rotate: '-38deg' }],
  },
  mapGlyphWrap: {
    width: 20,
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapGlyphPanel: {
    width: 7,
    height: 12,
    borderWidth: 1.8,
    borderColor: colors.textSecondary,
    borderRightWidth: 0.9,
    borderRadius: 2,
    transform: [{ skewY: '-12deg' }],
  },
  mapGlyphFold: {
    width: 6,
    height: 12,
    borderWidth: 1.8,
    borderLeftWidth: 0.9,
    borderRightWidth: 0.9,
    borderColor: colors.textSecondary,
    borderRadius: 2,
    marginLeft: -1,
    transform: [{ skewY: '12deg' }],
  },
  mapGlyphFoldRight: {
    borderRightWidth: 1.8,
  },
});
