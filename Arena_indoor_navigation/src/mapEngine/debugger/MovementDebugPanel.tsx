import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from '../../components/theme';
import type { MovementDebugSnapshot } from './movementDebugModel';

type MovementDebugPanelProps = {
  snapshot: MovementDebugSnapshot;
  onReset: () => void;
};

function display(value: number | string | null, digits = 2): string {
  if (value === null) {
    return 'unavailable';
  }
  return typeof value === 'number' ? value.toFixed(digits) : value;
}

export function MovementDebugPanel({
  snapshot,
  onReset,
}: MovementDebugPanelProps) {
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>Movement debugger</Text>
        <Text style={styles.status}>{snapshot.status}</Text>
      </View>
      <Text style={styles.line}>
        Samples {snapshot.totalSamples} | latest {snapshot.latestSampleKind ?? 'none'}
      </Text>
      <Text style={styles.line}>
        A {snapshot.counts.accelerometer} | G {snapshot.counts.gyroscope} | M{' '}
        {snapshot.counts.magnetometer} | DM {snapshot.counts.deviceMotion} | P{' '}
        {snapshot.counts.pedometer}
      </Text>
      <Text style={styles.line}>
        Timestamp {display(snapshot.latestTimestamp, 0)} | steps{' '}
        {display(snapshot.pedometerSteps, 0)}
      </Text>
      <Text style={styles.line}>
        Position {display(snapshot.position.x)}, {display(snapshot.position.y)} m |
        heading {display(snapshot.headingDegrees, 0)} deg
      </Text>
      <Text style={styles.line}>
        Confidence {display(snapshot.confidence)} | generation{' '}
        {display(snapshot.particleGeneration, 0)}
      </Text>
      <View style={styles.footer}>
        <Text style={styles.destination}>Destination {snapshot.destinationLabel}</Text>
        <Pressable style={styles.resetButton} onPress={onReset}>
          <Text style={styles.resetText}>Reset navigation</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 10,
    padding: 12,
    gap: 3,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  status: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  line: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  footer: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  destination: {
    color: colors.orange,
    fontSize: 11,
    fontWeight: '900',
  },
  resetButton: {
    minHeight: 30,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.orange,
  },
  resetText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
});
