import { Pressable, StyleSheet, Text, View } from 'react-native';

type ZoomControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  zoomPercent: number;
};

export function ZoomControls({
  onZoomIn,
  onZoomOut,
  zoomPercent,
}: ZoomControlsProps) {
  return (
    <View style={styles.zoomControls}>
      <Pressable
        accessibilityLabel="Zoom out"
        onPress={onZoomOut}
        style={({ pressed }) => [
          styles.zoomButton,
          pressed && styles.zoomButtonPressed,
        ]}
      >
        <Text style={styles.zoomButtonText}>-</Text>
      </Pressable>
      <Text style={styles.zoomValue}>{zoomPercent}%</Text>
      <Pressable
        accessibilityLabel="Zoom in"
        onPress={onZoomIn}
        style={({ pressed }) => [
          styles.zoomButton,
          pressed && styles.zoomButtonPressed,
        ]}
      >
        <Text style={styles.zoomButtonText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  zoomControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  zoomButton: {
    alignItems: 'center',
    backgroundColor: '#1d4ed8',
    borderRadius: 6,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  zoomButtonPressed: {
    backgroundColor: '#163fae',
  },
  zoomButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
  },
  zoomValue: {
    color: '#17202f',
    fontSize: 12,
    fontWeight: '700',
    minWidth: 38,
    textAlign: 'center',
  },
});
