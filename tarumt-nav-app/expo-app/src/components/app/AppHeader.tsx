import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ZoomControls } from './ZoomControls';

type AppHeaderProps = {
  distanceRemainingPixels: number;
  mode: 'edges' | 'navigate';
  onModeChange: (mode: 'edges' | 'navigate') => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  status: string;
  zoomPercent: number;
};

export function AppHeader({
  distanceRemainingPixels,
  mode,
  onModeChange,
  onZoomIn,
  onZoomOut,
  status,
  zoomPercent,
}: AppHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Tiled Map Phase 1</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {mode === 'edges'
            ? 'Edge JSON editor'
            : `${status} - ${Math.round(distanceRemainingPixels)}px left`}
        </Text>
      </View>
      <View style={styles.actions}>
        <View style={styles.modeToggle}>
          <ModeButton
            active={mode === 'navigate'}
            label="Navigate"
            onPress={() => onModeChange('navigate')}
          />
          <ModeButton
            active={mode === 'edges'}
            label="Edges"
            onPress={() => onModeChange('edges')}
          />
        </View>
        <ZoomControls
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          zoomPercent={zoomPercent}
        />
      </View>
    </View>
  );
}

type ModeButtonProps = {
  active: boolean;
  label: string;
  onPress: () => void;
};

function ModeButton({ active, label, onPress }: ModeButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.modeButton, active && styles.activeModeButton]}
    >
      <Text style={[styles.modeButtonText, active && styles.activeModeButtonText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#d9dee7',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  title: {
    color: '#17202f',
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    color: '#667085',
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  modeToggle: {
    backgroundColor: '#eef2f7',
    borderRadius: 6,
    flexDirection: 'row',
    padding: 2,
  },
  modeButton: {
    alignItems: 'center',
    borderRadius: 4,
    justifyContent: 'center',
    minHeight: 30,
    minWidth: 68,
    paddingHorizontal: 8,
  },
  activeModeButton: {
    backgroundColor: '#0f172a',
  },
  modeButtonText: {
    color: '#475467',
    fontSize: 12,
    fontWeight: '800',
  },
  activeModeButtonText: {
    color: '#ffffff',
  },
});
