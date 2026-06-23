import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from '../theme';

type NavigationSummaryCardProps = {
  destinationLabel: string;
  remainingDistanceMeters: number;
  estimatedTimeSeconds: number;
  estimatedSteps: number;
  nextStep: string;
};

function formatDistance(distanceMeters: number): string {
  return `${Math.max(0, Math.round(distanceMeters))} m`;
}

function formatEta(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

export function NavigationSummaryCard({
  destinationLabel,
  remainingDistanceMeters,
  estimatedTimeSeconds,
  estimatedSteps,
  nextStep,
}: NavigationSummaryCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>DESTINATION</Text>
          <Text style={styles.destination}>{destinationLabel}</Text>
        </View>
        <View style={styles.endTripButton}>
          <Text style={styles.endTripText}>End trip</Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Ionicons name="location" size={22} color="#1f83ff" />
          <Text style={styles.metricLabel}>Distance</Text>
          <Text style={styles.metricValue}>{formatDistance(remainingDistanceMeters)}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Ionicons name="time" size={20} color={colors.green} />
          <Text style={styles.metricLabel}>Est. time</Text>
          <Text style={styles.metricValue}>{formatEta(estimatedTimeSeconds)}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Ionicons name="footsteps" size={22} color={colors.orange} />
          <Text style={styles.metricLabel}>Steps</Text>
          <Text style={styles.metricValue}>{estimatedSteps}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <MaterialCommunityIcons name="source-branch" size={20} color={colors.text} />
          <Text style={styles.metricLabel}>Route</Text>
          <Text style={styles.metricValue}>Best</Text>
        </View>
      </View>

      <View style={styles.nextStepCard}>
        <View style={styles.nextStepIcon}>
          <Ionicons name="arrow-up" size={28} color="#ffffff" />
        </View>
        <View style={styles.nextStepCopy}>
          <Text style={styles.nextStepLabel}>Next step</Text>
          <Text style={styles.nextStepText}>{nextStep}</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#a0b5cb" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
    padding: 18,
    borderRadius: 28,
    backgroundColor: colors.surface,
    ...shadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  destination: {
    marginTop: 6,
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  endTripButton: {
    minHeight: 48,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: '#fff3ef',
  },
  endTripText: {
    color: '#cb4432',
    fontSize: 15,
    fontWeight: '900',
  },
  metrics: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  metric: {
    flex: 1,
    gap: 6,
  },
  metricDivider: {
    width: 1,
    marginHorizontal: 8,
    backgroundColor: colors.border,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  nextStepCard: {
    marginTop: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 22,
    backgroundColor: '#eaf3ff',
  },
  nextStepIcon: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    backgroundColor: '#1f83ff',
  },
  nextStepCopy: {
    flex: 1,
  },
  nextStepLabel: {
    color: '#1f83ff',
    fontSize: 12,
    fontWeight: '900',
  },
  nextStepText: {
    marginTop: 4,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
});
