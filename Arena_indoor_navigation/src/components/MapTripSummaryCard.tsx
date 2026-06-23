import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from './theme';

type MetricProps = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  value: string;
};

function Metric({ icon, color, label, value }: MetricProps) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={18} color={color} />
      <View>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  );
}

type MapTripSummaryCardProps = {
  destinationLabel: string;
  remainingDistanceMeters: number;
  estimatedTimeSeconds: number;
  estimatedSteps: number;
  nextStep: string;
};

export function MapTripSummaryCard({
  destinationLabel,
  remainingDistanceMeters,
  estimatedTimeSeconds,
  estimatedSteps,
  nextStep,
}: MapTripSummaryCardProps) {
  const distance = `${Math.max(0, Math.round(remainingDistanceMeters))} m`;
  const estimatedMinutes = `${Math.max(
    1,
    Math.round(estimatedTimeSeconds / 60),
  )} min`;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>DESTINATION</Text>
          <Text style={styles.destination}>{destinationLabel}</Text>
        </View>
        <Pressable accessibilityRole="button" style={styles.endButton}>
          <Text style={styles.endButtonText}>End trip</Text>
        </Pressable>
      </View>

      <View style={styles.metrics}>
        <Metric icon="location" color="#1478db" label="Distance" value={distance} />
        <Metric icon="time" color={colors.green} label="Est. time" value={estimatedMinutes} />
        <View style={styles.metric}>
          <MaterialCommunityIcons name="shoe-print" size={19} color={colors.orange} />
          <View>
            <Text style={styles.metricLabel}>Steps</Text>
            <Text style={styles.metricValue}>{estimatedSteps}</Text>
          </View>
        </View>
      </View>

      <View style={styles.nextStep}>
        <View style={styles.nextIcon}>
          <Ionicons name="arrow-up" size={20} color="#ffffff" />
        </View>
        <View style={styles.nextCopy}>
          <Text style={styles.nextLabel}>Next step</Text>
          <Text style={styles.nextTitle}>{nextStep}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#5e7487" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 10,
    gap: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: colors.green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.7,
  },
  destination: {
    marginTop: 2,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  endButton: {
    minHeight: 30,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: '#f8eee8',
  },
  endButtonText: {
    color: '#bd3e32',
    fontSize: 12,
    fontWeight: '800',
  },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  metric: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  metricValue: {
    marginTop: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  nextStep: {
    minHeight: 46,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.md,
    backgroundColor: '#e9f4ff',
  },
  nextIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: '#1478db',
  },
  nextCopy: {
    flex: 1,
  },
  nextLabel: {
    color: '#1478db',
    fontSize: 9,
    fontWeight: '800',
  },
  nextTitle: {
    marginTop: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
});
