import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from '../../components/theme';
import type { MovementSensorDevControls } from '../useMovementSensors';

type MovementSensorDevPanelProps = {
  controls: MovementSensorDevControls;
  embedded?: boolean;
};

function buttonTextForPlaybackState(playbackState: MovementSensorDevControls['playbackState']): string {
  switch (playbackState) {
    case 'paused':
      return 'Resume';
    case 'running':
      return 'Pause';
    default:
      return 'Start';
  }
}

function displayTimestamp(value: number | null): string {
  return value === null ? 'unavailable' : new Date(value).toLocaleTimeString();
}

function displayElapsedMs(lastEventTimestamp: number | null, nowMs: number): string {
  if (lastEventTimestamp === null) {
    return 'unavailable';
  }

  const elapsedSeconds = Math.max(0, Math.round((nowMs - lastEventTimestamp) / 1000));
  return `${elapsedSeconds}s`;
}

export function MovementSensorDevPanel({
  controls,
  embedded = false,
}: MovementSensorDevPanelProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const handle = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(handle);
  }, []);

  if (!controls.enabled) {
    return null;
  }

  return (
    <View style={[styles.panel, embedded && styles.panelEmbedded]}>
      <Text style={styles.title}>Sensor source debugger</Text>
      <View style={styles.modeRow}>
        {(['real', 'mock'] as const).map((mode) => (
          <Pressable
            key={mode}
            style={[styles.modeButton, controls.mode === mode && styles.modeButtonActive]}
            onPress={() => controls.setMode(mode)}
          >
            <Text
              style={[
                styles.modeButtonText,
                controls.mode === mode && styles.modeButtonTextActive,
              ]}
            >
              {mode === 'real' ? 'Real sensors' : 'Mock sensors'}
            </Text>
          </Pressable>
        ))}
      </View>

      {controls.mode === 'mock' ? (
        <>
          <Text style={styles.meta}>
            Scenario {controls.currentBatchIndex}/{controls.totalBatches} · {controls.playbackState}
          </Text>
          <View style={styles.scenarioList}>
            {controls.scenarios.map((scenario) => (
              <Pressable
                key={scenario.id}
                style={[
                  styles.scenarioButton,
                  controls.scenarioId === scenario.id && styles.scenarioButtonActive,
                ]}
                onPress={() => controls.setScenario(scenario.id)}
              >
                <Text
                  style={[
                    styles.scenarioLabel,
                    controls.scenarioId === scenario.id && styles.scenarioLabelActive,
                  ]}
                >
                  {scenario.label}
                </Text>
                <Text style={styles.scenarioDescription}>{scenario.description}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.controlsRow}>
            <Pressable
              style={styles.controlButton}
              onPress={
                controls.playbackState === 'running'
                  ? controls.pause
                  : controls.playbackState === 'paused'
                    ? controls.resume
                    : controls.start
              }
            >
              <Text style={styles.controlButtonText}>
                {buttonTextForPlaybackState(controls.playbackState)}
              </Text>
            </Pressable>
            <Pressable style={styles.controlButton} onPress={controls.advanceOneBatch}>
              <Text style={styles.controlButtonText}>Step batch</Text>
            </Pressable>
            <Pressable style={styles.resetButton} onPress={controls.reset}>
              <Text style={styles.resetButtonText}>Reset mock</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.meta}>Collector is bound to the Expo sensor adapter.</Text>
          <Text style={styles.meta}>
            Pipeline {controls.realSensors.collector.status} · first sample{' '}
            {displayTimestamp(controls.realSensors.collector.firstSampleAt)} · first batch{' '}
            {displayTimestamp(controls.realSensors.collector.firstBatchAt)}
          </Text>
          {Object.entries(controls.realSensors.adapter.sensors).map(
            ([kind, diagnostic]) => (
              <Text key={kind} style={styles.meta}>
                {kind} · {diagnostic.status} · ready{' '}
                {displayTimestamp(diagnostic.subscriptionReadyAt)} · first sample{' '}
                {displayTimestamp(diagnostic.firstSampleAt)}
                {diagnostic.errorMessage ? ` · ${diagnostic.errorMessage}` : ''}
              </Text>
            ),
          )}
          <Text style={styles.meta}>
            Availability {controls.realPedometer.diagnostic.availability} · permission{' '}
            {controls.realPedometer.diagnostic.permissionStatus} · canAskAgain{' '}
            {controls.realPedometer.diagnostic.canAskAgain === null
              ? 'unknown'
              : String(controls.realPedometer.diagnostic.canAskAgain)}
          </Text>
          <Text style={styles.meta}>
            Status {controls.realPedometer.diagnostic.status} · subscription started{' '}
            {controls.realPedometer.diagnostic.subscriptionStarted ? 'yes' : 'no'}
          </Text>
          <Text style={styles.meta}>
            Raw cumulative steps{' '}
            {controls.realPedometer.diagnostic.rawCumulativeSteps ?? 'unavailable'}
          </Text>
          <Text style={styles.meta}>
            Last event {displayTimestamp(controls.realPedometer.diagnostic.lastEventTimestamp)} ·
            age {displayElapsedMs(controls.realPedometer.diagnostic.lastEventTimestamp, nowMs)}
          </Text>
          <Text style={styles.meta}>
            Last attempt {displayTimestamp(controls.realPedometer.diagnostic.lastSubscriptionAttemptAt)}
          </Text>
          {controls.realPedometer.diagnostic.recentErrors.length > 0 ? (
            <View style={styles.errorPanel}>
              <Text style={styles.errorTitle}>Pedometer errors</Text>
              {controls.realPedometer.diagnostic.recentErrors
                .slice()
                .reverse()
                .map((error, index) => (
                  <Text key={`${error.timestamp}-${index}`} style={styles.errorLine}>
                    {error.stage} · {displayTimestamp(error.timestamp)} · {error.message}
                  </Text>
                ))}
            </View>
          ) : null}
          {(controls.realPedometer.diagnostic.status !== 'subscribed' ||
            controls.realPedometer.diagnostic.permissionStatus !== 'granted' ||
            controls.realPedometer.diagnostic.recentErrors.length > 0) ? (
            <View style={styles.controlsRow}>
              <Pressable style={styles.controlButton} onPress={() => void controls.realPedometer.retry()}>
                <Text style={styles.controlButtonText}>Request permission / Retry subscription</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 16,
    padding: 14,
    gap: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow,
  },
  panelEmbedded: {
    marginTop: 0,
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    flex: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  modeButtonActive: {
    backgroundColor: colors.green,
  },
  modeButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  modeButtonTextActive: {
    color: '#ffffff',
  },
  scenarioList: {
    gap: 8,
  },
  scenarioButton: {
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  scenarioButtonActive: {
    backgroundColor: colors.orangeSoft,
  },
  scenarioLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  scenarioLabelActive: {
    color: colors.orange,
  },
  scenarioDescription: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    flex: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  controlButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  resetButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.orange,
  },
  resetButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  errorPanel: {
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.orangeSoft,
    gap: 4,
  },
  errorTitle: {
    color: colors.orange,
    fontSize: 11,
    fontWeight: '900',
  },
  errorLine: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
});
