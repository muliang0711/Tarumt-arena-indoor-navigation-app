import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';

import { colors, radii, spacing } from '../../../shared/theme/tokens';

interface HomeActionStackProps {
  onStartNavigation: () => void;
}

type DockItemId = 'home' | 'start' | 'map';

export function HomeActionStack({ onStartNavigation }: HomeActionStackProps) {
  const [activeItem, setActiveItem] = useState<DockItemId | null>(null);

  function handlePress(itemId: DockItemId) {
    if (itemId === 'start' && activeItem === 'start') {
      onStartNavigation();
      return;
    }

    if (activeItem === itemId) {
      setActiveItem(null);
      return;
    }

    setActiveItem(itemId);
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
        <DockItem
          active={activeItem === 'home'}
          label="Home"
          onPress={() => handlePress('home')}
          icon={<HomeGlyph active={activeItem === 'home'} />}
        />
        <DockItem
          active={activeItem === 'start'}
          label="Start"
          onPress={() => handlePress('start')}
          icon={<StartGlyph active={activeItem === 'start'} />}
        />
        <DockItem
          active={activeItem === 'map'}
          label="Map"
          onPress={() => handlePress('map')}
          icon={<MapGlyph active={activeItem === 'map'} />}
        />
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
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.dockItem,
        active && styles.dockItemActive,
        pressed && styles.dockItemPressed,
      ]}
    >
      <View style={styles.dockItemIconWrap}>{icon}</View>
      {active ? <Text style={styles.dockItemLabel}>{label}</Text> : null}
    </Pressable>
  );
}

function HomeGlyph({ active }: { active: boolean }) {
  return (
    <View style={styles.glyphBox}>
      <View
        style={[
          styles.homeGlyphRoof,
          active && styles.glyphLineActive,
        ]}
      />
      <View
        style={[
          styles.homeGlyphBody,
          active && styles.glyphBorderActive,
        ]}
      />
    </View>
  );
}

function StartGlyph({ active }: { active: boolean }) {
  return (
    <View style={styles.glyphBox}>
      <View
        style={[
          styles.startGlyphDiamond,
          active && styles.glyphBorderActive,
        ]}
      />
      <View
        style={[
          styles.startGlyphTail,
          active && styles.glyphLineActive,
        ]}
      />
    </View>
  );
}

function MapGlyph({ active }: { active: boolean }) {
  return (
    <View style={styles.mapGlyphWrap}>
      <View
        style={[
          styles.mapGlyphPanel,
          active && styles.glyphBorderActive,
        ]}
      />
      <View
        style={[
          styles.mapGlyphFold,
          active && styles.glyphBorderActive,
        ]}
      />
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
    minWidth: 58,
    height: 58,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(244, 247, 252, 0.16)',
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dockItemActive: {
    minWidth: 122,
    backgroundColor: 'rgba(244, 247, 252, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.76)',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 10,
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
