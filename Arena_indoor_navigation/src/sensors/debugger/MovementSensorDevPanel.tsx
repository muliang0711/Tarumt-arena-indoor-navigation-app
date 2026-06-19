import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from '../../components/theme';
import type { MovementSensorDevControls } from '../useMovementSensors';

type MovementSensorDevPanelProps = {
  controls: MovementSensorDevControls;
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

export function MovementSensorDevPanel({
  controls,
}: MovementSensorDevPanelProps) {
  if (!controls.enabled) {
    return null;
  }

  return (
    <View style={styles.panel}>
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
        <Text style={styles.meta}>Collector is bound to the Expo sensor adapter.</Text>
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
});
