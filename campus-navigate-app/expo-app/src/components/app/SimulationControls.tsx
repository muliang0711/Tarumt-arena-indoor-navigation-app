import { Pressable, StyleSheet, Text, View } from 'react-native';

type SimulationControlsProps = {
  onPause: () => void;
  onReset: () => void;
  onStart: () => void;
  onStepForward: () => void;
};

export function SimulationControls({
  onPause,
  onReset,
  onStart,
  onStepForward,
}: SimulationControlsProps) {
  return (
    <View style={styles.simulationControls}>
      <SimulationButton
        accessibilityLabel="Start route simulation"
        label="Start"
        onPress={onStart}
      />
      <SimulationButton
        accessibilityLabel="Pause route simulation"
        label="Pause"
        onPress={onPause}
      />
      <SimulationButton
        accessibilityLabel="Step route simulation"
        label="Step"
        onPress={onStepForward}
      />
      <SimulationButton
        accessibilityLabel="Reset route simulation"
        label="Reset"
        onPress={onReset}
      />
    </View>
  );
}

type SimulationButtonProps = {
  accessibilityLabel: string;
  label: string;
  onPress: () => void;
};

function SimulationButton({
  accessibilityLabel,
  label,
  onPress,
}: SimulationButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.controlButton,
        pressed && styles.controlButtonPressed,
      ]}
    >
      <Text style={styles.controlButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  simulationControls: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#d9dee7',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  controlButton: {
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 6,
    flex: 1,
    justifyContent: 'center',
    minHeight: 34,
  },
  controlButtonPressed: {
    backgroundColor: '#334155',
  },
  controlButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
