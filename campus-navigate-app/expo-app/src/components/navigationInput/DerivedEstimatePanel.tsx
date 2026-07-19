import { Pressable, StyleSheet, Text, View } from 'react-native';

import type {
  DerivedEstimateBuffer,
  DerivedEstimateIngestResult,
  RawMotionBatchStats,
  RawMotionConsumerStatus,
} from '../../navigationInput';
import type { WrongWayRerouteResult } from '../../reroute';

type DerivedEstimatePanelProps = {
  buffer: DerivedEstimateBuffer;
  lastResult: DerivedEstimateIngestResult | null;
  onReplayStep: () => void;
  onReset: () => void;
  onStartRawMotion: () => void;
  onStopRawMotion: () => void;
  rawMotionStats: RawMotionBatchStats;
  rawMotionStatus: RawMotionConsumerStatus;
  routeTotalMeters: number;
  snapDriftPixels: number | null;
  stepLengthMeters: number;
  stepLengthPixels: number;
  wrongWayReroute: WrongWayRerouteResult;
};

export function DerivedEstimatePanel({
  buffer,
  lastResult,
  onReplayStep,
  onReset,
  onStartRawMotion,
  onStopRawMotion,
  rawMotionStats,
  rawMotionStatus,
  routeTotalMeters,
  snapDriftPixels,
  stepLengthMeters,
  stepLengthPixels,
  wrongWayReroute,
}: DerivedEstimatePanelProps) {
  const estimateStatus = lastResult
    ? `${lastResult.reason} | accepted ${buffer.acceptedEstimates.length} | dropped ${buffer.droppedEstimateCount}`
    : 'idle';
  const sensorStatus = `${rawMotionStatus} | raw ${
    rawMotionStats.rawSamplesInMemory
  } | batches ${rawMotionStats.totalBatches} | head ${
    rawMotionStats.lastHeadingDegrees === null
      ? '-'
      : Math.round(rawMotionStats.lastHeadingDegrees)
  }`;
  const wrongWayStatus = `${
    wrongWayReroute.shouldSuggestReroute ? 'suggest' : 'hold'
  } | ${wrongWayReroute.reason} | ${
    wrongWayReroute.currentNode?.nodeId ?? '-'
  } | ${Math.round(wrongWayReroute.oppositeHeadingDurationMs)}ms`;
  const routeStatus = `${routeTotalMeters}m route | ${stepLengthMeters}m step -> ${Math.round(
    stepLengthPixels,
  )}px | drift ${
    snapDriftPixels === null ? '-' : Math.round(snapDriftPixels)
  }px`;

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Estimate</Text>
        <Text style={styles.statusPill} numberOfLines={1}>
          {rawMotionStatus}
        </Text>
      </View>
      <View style={styles.detailGrid}>
        <DetailCell label="PDR" value={estimateStatus} />
        <DetailCell label="Sensor" value={sensorStatus} />
        <DetailCell
          emphasized={wrongWayReroute.shouldSuggestReroute}
          label="Wrong Way"
          value={wrongWayStatus}
        />
        <DetailCell label="Route" value={routeStatus} />
      </View>
      <View style={styles.actions}>
        <PanelButton
          accessibilityLabel="Start raw motion PDR"
          label="Start"
          onPress={onStartRawMotion}
          variant="start"
        />
        <PanelButton
          accessibilityLabel="Stop raw motion PDR"
          label="Stop"
          onPress={onStopRawMotion}
          variant="stop"
        />
        <PanelButton
          accessibilityLabel="Replay derived estimate"
          label="Replay"
          onPress={onReplayStep}
        />
        <PanelButton
          accessibilityLabel="Reset derived estimate marker"
          label="Reset"
          onPress={onReset}
        />
      </View>
    </View>
  );
}

type DetailCellProps = {
  emphasized?: boolean;
  label: string;
  value: string;
};

function DetailCell({ emphasized = false, label, value }: DetailCellProps) {
  return (
    <View style={[styles.detailCell, emphasized && styles.emphasizedCell]}>
      <Text style={[styles.detailLabel, emphasized && styles.emphasizedText]}>
        {label}
      </Text>
      <Text
        style={[styles.detailValue, emphasized && styles.emphasizedText]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

type PanelButtonProps = {
  accessibilityLabel: string;
  label: string;
  onPress: () => void;
  variant?: 'default' | 'start' | 'stop';
};

function PanelButton({
  accessibilityLabel,
  label,
  onPress,
  variant = 'default',
}: PanelButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'start' && styles.startButton,
        variant === 'stop' && styles.stopButton,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#d9dee7',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusPill: {
    backgroundColor: '#e8eef6',
    borderRadius: 4,
    color: '#334155',
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 7,
  },
  detailCell: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '48.5%',
    flexGrow: 1,
    minHeight: 46,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  emphasizedCell: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  detailLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  detailValue: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
    marginTop: 2,
  },
  emphasizedText: {
    color: '#7f1d1d',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#7f1d1d',
    borderRadius: 6,
    flex: 1,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 10,
  },
  buttonPressed: {
    backgroundColor: '#991b1b',
  },
  startButton: {
    backgroundColor: '#166534',
  },
  stopButton: {
    backgroundColor: '#334155',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});
