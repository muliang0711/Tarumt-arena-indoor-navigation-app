import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';

import { FloorLabel, DatasetSummary, CompareResult, Dataset } from './src/types';
import { useMagnetometer } from './src/useMagnetometer';
import {
  saveDataset,
  loadDataset,
  deleteDataset,
  getDatasetSummary,
} from './src/storage';
import { compareDatasets } from './src/compare';
import { shareDataset } from './src/export';

// ─── Helpers ─────────────────────────────────────────────

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return min > 0 ? `${min}m ${s}s` : `${s}s`;
}

// ─── Constants ───────────────────────────────────────────

const SAMPLING_HZ = 50;

const COLORS = {
  bg: '#0f0f1a',
  card: '#1a1a2e',
  cardBorder: '#2a2a4a',
  accent1: '#4a9eff',     // Floor 1 — blue
  accent2: '#4aff9e',     // Floor 2 — green
  recording: '#ff4a6a',   // recording state
  text: '#e8e8f0',
  textDim: '#8888aa',
  success: '#4aff9e',
  warning: '#ffaa4a',
  danger: '#ff4a6a',
  white: '#ffffff',
};

// ═════════════════════════════════════════════════════════
//  APP
// ═════════════════════════════════════════════════════════

export default function App() {
  // ── State ────────────────────────────────────────────
  const [selectedFloor, setSelectedFloor] = useState<FloorLabel>('Floor 1');
  const [floor1Summary, setFloor1Summary] = useState<DatasetSummary>(emptySummary());
  const [floor2Summary, setFloor2Summary] = useState<DatasetSummary>(emptySummary());
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const mag = useMagnetometer();

  // ── Load summaries on mount ──────────────────────────
  const refreshSummaries = useCallback(async () => {
    const [s1, s2] = await Promise.all([
      getDatasetSummary('Floor 1'),
      getDatasetSummary('Floor 2'),
    ]);
    setFloor1Summary(s1);
    setFloor2Summary(s2);
  }, []);

  useEffect(() => {
    refreshSummaries();
  }, [refreshSummaries]);

  // ── Handlers ─────────────────────────────────────────

  const handleStart = () => {
    mag.clearSamples();
    setCompareResult(null);
    mag.startRecording(SAMPLING_HZ);
  };

  const handleStop = () => {
    mag.stopRecording();
  };

  const handleSave = async () => {
    if (mag.sampleCount === 0) {
      Alert.alert('No Data', 'Please record some data before saving.');
      return;
    }

    setIsSaving(true);
    try {
      const dataset: Dataset = {
        datasetId: uuid(),
        label: selectedFloor,
        createdAt: new Date().toISOString(),
        samples: [...mag.samples],
        meta: {
          samplingHz: SAMPLING_HZ,
          device: `${Constants.deviceName ?? 'Unknown'} (${Platform.OS})`,
        },
      };
      await saveDataset(dataset);
      await refreshSummaries();
      mag.clearSamples();
      Alert.alert('Saved ✓', `${selectedFloor} dataset saved (${dataset.samples.length} samples)`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    if (mag.isRecording) mag.stopRecording();
    mag.clearSamples();
  };

  const handleCompare = async () => {
    if (!floor1Summary.exists || !floor2Summary.exists) {
      Alert.alert(
        'Missing Data',
        'Please record and save both Floor 1 and Floor 2 datasets before comparing.'
      );
      return;
    }

    setIsComparing(true);
    setCompareResult(null);
    try {
      const [ds1, ds2] = await Promise.all([
        loadDataset('Floor 1'),
        loadDataset('Floor 2'),
      ]);
      if (!ds1 || !ds2) {
        Alert.alert('Error', 'Could not load datasets.');
        return;
      }
      const magA = ds1.samples.map((s) => s.magnitude);
      const magB = ds2.samples.map((s) => s.magnitude);

      // Run comparison (might take a moment for large datasets)
      const result = compareDatasets(magA, magB);
      setCompareResult(result);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsComparing(false);
    }
  };

  const handleExport = async (label: FloorLabel) => {
    try {
      const ok = await shareDataset(label);
      if (!ok) {
        Alert.alert('No Data', `No saved ${label} dataset to export.`);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDelete = (label: FloorLabel) => {
    Alert.alert(
      `Delete ${label}?`,
      'This will permanently remove the saved dataset.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteDataset(label);
            await refreshSummaries();
            setCompareResult(null);
          },
        },
      ]
    );
  };

  // ── Derived ──────────────────────────────────────────

  const accentColor = selectedFloor === 'Floor 1' ? COLORS.accent1 : COLORS.accent2;

  // ── Render ───────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══ Header ═══ */}
        <View style={styles.header}>
          <Text style={styles.title}>🧲 MagCollect</Text>
          <Text style={styles.subtitle}>Magnetometer Data Collection</Text>
        </View>

        {/* ═══ Floor Selector ═══ */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Select Floor</Text>
        </View>
        <View style={styles.segmentContainer}>
          <SegmentButton
            label="Floor 1"
            active={selectedFloor === 'Floor 1'}
            color={COLORS.accent1}
            onPress={() => !mag.isRecording && setSelectedFloor('Floor 1')}
            disabled={mag.isRecording}
          />
          <SegmentButton
            label="Floor 2"
            active={selectedFloor === 'Floor 2'}
            color={COLORS.accent2}
            onPress={() => !mag.isRecording && setSelectedFloor('Floor 2')}
            disabled={mag.isRecording}
          />
        </View>

        {/* ═══ Recording Panel ═══ */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recording</Text>
          <View style={[styles.badge, { backgroundColor: accentColor + '22' }]}>
            <Text style={[styles.badgeText, { color: accentColor }]}>
              {selectedFloor} · {SAMPLING_HZ} Hz
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          {/* Status Row */}
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: mag.isRecording ? COLORS.recording : COLORS.textDim },
                ]}
              />
              <Text style={styles.statusLabel}>
                {mag.isRecording ? 'Recording…' : 'Idle'}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusValue}>{mag.sampleCount}</Text>
              <Text style={styles.statusLabel}>Samples</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusValue}>
                {mag.lastMagnitude != null ? mag.lastMagnitude.toFixed(1) : '—'}
              </Text>
              <Text style={styles.statusLabel}>µT</Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            {!mag.isRecording ? (
              <ActionButton
                label="▶  Start"
                color={COLORS.success}
                onPress={handleStart}
              />
            ) : (
              <ActionButton
                label="⏹  Stop"
                color={COLORS.recording}
                onPress={handleStop}
              />
            )}
            <ActionButton
              label="💾  Save"
              color={COLORS.accent1}
              onPress={handleSave}
              disabled={mag.isRecording || mag.sampleCount === 0 || isSaving}
            />
            <ActionButton
              label="🗑  Clear"
              color={COLORS.textDim}
              onPress={handleClear}
              disabled={mag.sampleCount === 0}
            />
          </View>
        </View>

        {/* ═══ Dataset Status Cards ═══ */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Saved Datasets</Text>
        </View>

        <DatasetCard
          label="Floor 1"
          summary={floor1Summary}
          color={COLORS.accent1}
          onExport={() => handleExport('Floor 1')}
          onDelete={() => handleDelete('Floor 1')}
        />
        <DatasetCard
          label="Floor 2"
          summary={floor2Summary}
          color={COLORS.accent2}
          onExport={() => handleExport('Floor 2')}
          onDelete={() => handleDelete('Floor 2')}
        />

        {/* ═══ Compare Section ═══ */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Compare</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.compareButton,
            (!floor1Summary.exists || !floor2Summary.exists) && styles.buttonDisabled,
          ]}
          onPress={handleCompare}
          disabled={isComparing}
        >
          <Text style={styles.compareButtonText}>
            {isComparing ? '⏳ Comparing…' : '⚡ Compare Floor 1 vs Floor 2'}
          </Text>
        </TouchableOpacity>

        {!floor1Summary.exists || !floor2Summary.exists ? (
          <Text style={styles.hintText}>
            {!floor1Summary.exists && !floor2Summary.exists
              ? 'Record and save both Floor 1 and Floor 2 to enable comparison.'
              : !floor1Summary.exists
                ? 'Record and save Floor 1 to enable comparison.'
                : 'Record and save Floor 2 to enable comparison.'}
          </Text>
        ) : null}

        {compareResult && <CompareResultCard result={compareResult} />}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ═════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═════════════════════════════════════════════════════════

function emptySummary(): DatasetSummary {
  return { exists: false, sampleCount: 0, durationMs: 0, createdAt: null };
}

// ── Segment Button ────────────────────────────────────

function SegmentButton({
  label,
  active,
  color,
  onPress,
  disabled,
}: {
  label: string;
  active: boolean;
  color: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.segmentButton,
        active && { backgroundColor: color + '30', borderColor: color },
        disabled && !active && { opacity: 0.4 },
      ]}
    >
      <Text
        style={[
          styles.segmentText,
          active && { color, fontWeight: '700' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Action Button ─────────────────────────────────────

function ActionButton({
  label,
  color,
  onPress,
  disabled,
}: {
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        { backgroundColor: color + '20', borderColor: color + '55' },
        disabled && { opacity: 0.35 },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.actionButtonText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Dataset Card ──────────────────────────────────────

function DatasetCard({
  label,
  summary,
  color,
  onExport,
  onDelete,
}: {
  label: string;
  summary: DatasetSummary;
  color: string;
  onExport: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.card, { borderLeftColor: color, borderLeftWidth: 3 }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color }]}>{label}</Text>
        <View
          style={[
            styles.statusChip,
            { backgroundColor: summary.exists ? COLORS.success + '22' : COLORS.textDim + '22' },
          ]}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: summary.exists ? COLORS.success : COLORS.textDim,
            }}
          >
            {summary.exists ? '✓ SAVED' : '✗ EMPTY'}
          </Text>
        </View>
      </View>

      {summary.exists ? (
        <>
          <View style={styles.cardStats}>
            <StatItem label="Samples" value={String(summary.sampleCount)} />
            <StatItem label="Duration" value={formatDuration(summary.durationMs)} />
            <StatItem
              label="Recorded"
              value={
                summary.createdAt
                  ? new Date(summary.createdAt).toLocaleDateString()
                  : '—'
              }
            />
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.smallButton} onPress={onExport}>
              <Text style={[styles.smallButtonText, { color: COLORS.accent1 }]}>
                📤 Export
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.smallButton} onPress={onDelete}>
              <Text style={[styles.smallButtonText, { color: COLORS.danger }]}>
                🗑 Delete
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <Text style={styles.cardEmpty}>No data recorded yet.</Text>
      )}
    </View>
  );
}

// ── Compare Result Card ───────────────────────────────

function CompareResultCard({ result }: { result: CompareResult }) {
  const conclusionColor =
    result.conclusion === 'Very Similar'
      ? COLORS.success
      : result.conclusion === 'Similar'
        ? COLORS.warning
        : COLORS.danger;

  return (
    <View style={[styles.card, { borderColor: conclusionColor, borderWidth: 1 }]}>
      <View style={styles.resultHeader}>
        <Text style={[styles.conclusionText, { color: conclusionColor }]}>
          {result.conclusion === 'Very Similar'
            ? '✅ Very Similar'
            : result.conclusion === 'Similar'
              ? '🟡 Similar'
              : '❌ Different'}
        </Text>
      </View>

      <View style={styles.resultGrid}>
        <View style={styles.resultItem}>
          <Text style={styles.resultValue}>
            {(result.cosineSimilarity * 100).toFixed(1)}%
          </Text>
          <Text style={styles.resultLabel}>Cosine Similarity</Text>
          <ProgressBar value={result.cosineSimilarity} color={COLORS.accent1} />
        </View>

        <View style={styles.resultItem}>
          <Text style={styles.resultValue}>
            {result.dtwDistance.toFixed(2)}
          </Text>
          <Text style={styles.resultLabel}>DTW Distance</Text>
          <Text style={styles.resultSubLabel}>
            (normalized: {(result.normalizedDTW * 100).toFixed(1)}%)
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Progress Bar ──────────────────────────────────────

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <View style={styles.progressBg}>
      <View
        style={[
          styles.progressFill,
          { width: `${Math.max(2, value * 100)}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

// ── Stat Item ─────────────────────────────────────────

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ═════════════════════════════════════════════════════════
//  STYLES
// ═════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: (Constants.statusBarHeight ?? 44) + 8,
    paddingHorizontal: 16,
  },

  // ── Header ──
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textDim,
    marginTop: 4,
  },

  // ── Section ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  // ── Badge ──
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Segment ──
  segmentContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.card,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textDim,
  },

  // ── Card ──
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  cardStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cardEmpty: {
    color: COLORS.textDim,
    fontSize: 13,
    fontStyle: 'italic',
  },

  // ── Status row ──
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statusItem: {
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    fontSize: 12,
    color: COLORS.textDim,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
  },

  // ── Buttons ──
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  smallButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
  },
  smallButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Compare ──
  compareButton: {
    backgroundColor: '#6c3aff',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  compareButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  hintText: {
    color: COLORS.textDim,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },

  // ── Result Card ──
  resultHeader: {
    alignItems: 'center',
    marginBottom: 14,
  },
  conclusionText: {
    fontSize: 22,
    fontWeight: '800',
  },
  resultGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  resultItem: {
    flex: 1,
    alignItems: 'center',
  },
  resultValue: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.white,
  },
  resultLabel: {
    fontSize: 11,
    color: COLORS.textDim,
    marginTop: 4,
    textAlign: 'center',
  },
  resultSubLabel: {
    fontSize: 10,
    color: COLORS.textDim,
    marginTop: 2,
  },

  // ── Progress bar ──
  progressBg: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.bg,
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },

  // ── Stat item ──
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textDim,
    marginTop: 2,
  },
});
