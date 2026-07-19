import { StyleSheet, Text, View } from 'react-native';

import type { NavigationUiState } from '../../navigation';

type NavigationStatsPanelProps = {
  navigation: NavigationUiState;
};

export function NavigationStatsPanel({ navigation }: NavigationStatsPanelProps) {
  return (
    <View style={styles.statsPanel}>
      <StatCell label="Segment" value={navigation.currentSegment} wide />
      <StatCell
        label="Progress"
        value={`${Math.round(navigation.progressPercent)}%`}
      />
      <StatCell
        label="Remaining"
        value={`${Math.round(navigation.distanceRemainingPixels)}px`}
      />
      <StatCell label="Status" value={navigation.status} />
    </View>
  );
}

type StatCellProps = {
  label: string;
  value: string;
  wide?: boolean;
};

function StatCell({ label, value, wide = false }: StatCellProps) {
  return (
    <View style={[styles.statCell, wide && styles.wideStatCell]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={wide ? 2 : 1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statsPanel: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#d9dee7',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statCell: {
    flex: 1,
    minWidth: 0,
  },
  wideStatCell: {
    flex: 1.5,
  },
  statLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statValue: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 15,
    marginTop: 2,
  },
});
