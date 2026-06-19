import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from '../../components/theme';
import type {
  NavigationDebugState,
  NavigationDestinationId,
} from './navigationDebugModel';

type SelectableDestination = {
  nodeId: NavigationDestinationId;
  available: boolean;
};

type NavigationDebugPanelProps = {
  state: NavigationDebugState;
  destinations: readonly SelectableDestination[];
  onSelectDestination: (destination: NavigationDestinationId) => void;
  onCalculateRoute: () => void;
  onClearRoute: () => void;
  onToggleUnwalkable: () => void;
};

function nodeLabel(nodeId: string): string {
  return nodeId.replace(/^node_/, 'Node ');
}

export function NavigationDebugPanel({
  state,
  destinations,
  onSelectDestination,
  onCalculateRoute,
  onClearRoute,
  onToggleUnwalkable,
}: NavigationDebugPanelProps) {
  const routeLabel =
    state.routeStatus === 'ready' && state.highlightedPath
      ? state.highlightedPath.nodeIds.map(nodeLabel).join(' → ')
      : state.routeStatus === 'no-route'
        ? 'No route available'
        : 'Route not calculated';

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>NAVIGATION LAB</Text>
          <Text style={styles.title}>
            Start {nodeLabel(state.originNodeId)}
          </Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{state.routeStatus}</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Destination</Text>
      <View style={styles.destinationRow}>
        {destinations.map((destination) => {
          const selected = state.selectedDestinationId === destination.nodeId;
          return (
            <Pressable
              key={destination.nodeId}
              accessibilityRole="button"
              accessibilityState={{
                selected,
                disabled: !destination.available,
              }}
              disabled={!destination.available}
              onPress={() => onSelectDestination(destination.nodeId)}
              style={[
                styles.destinationButton,
                selected && styles.destinationButtonSelected,
                !destination.available && styles.buttonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.destinationText,
                  selected && styles.destinationTextSelected,
                ]}
              >
                {nodeLabel(destination.nodeId)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.routeReadout}>
        <View style={styles.routeSwatch} />
        <Text
          numberOfLines={2}
          style={[
            styles.routeLabel,
            state.routeStatus === 'no-route' && styles.noRouteLabel,
          ]}
        >
          {routeLabel}
        </Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable style={styles.primaryButton} onPress={onCalculateRoute}>
          <Text style={styles.primaryButtonText}>Calculate route</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onClearRoute}>
          <Text style={styles.secondaryButtonText}>Clear route</Text>
        </Pressable>
        <Pressable
          style={[
            styles.overlayButton,
            state.showUnwalkableOverlay && styles.overlayButtonActive,
          ]}
          onPress={onToggleUnwalkable}
        >
          <View style={styles.redSwatch} />
          <Text style={styles.overlayButtonText}>
            {state.showUnwalkableOverlay ? 'Hide blocked' : 'Show blocked'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 10,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
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
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 2,
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  destinationRow: {
    flexDirection: 'row',
    gap: 7,
  },
  destinationButton: {
    minHeight: 34,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  destinationButtonSelected: {
    borderColor: colors.orange,
    backgroundColor: colors.orange,
  },
  destinationText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  destinationTextSelected: {
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  routeReadout: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: '#edf6ff',
  },
  routeSwatch: {
    width: 18,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#1479d1',
  },
  routeLabel: {
    flex: 1,
    color: '#155b98',
    fontSize: 10,
    fontWeight: '800',
  },
  noRouteLabel: {
    color: '#a32828',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  primaryButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: '#1479d1',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
  },
  overlayButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#efc4c4',
    borderRadius: radius.pill,
    backgroundColor: '#fff5f5',
  },
  overlayButtonActive: {
    borderColor: '#d52e2e',
    backgroundColor: '#ffe7e7',
  },
  redSwatch: {
    width: 9,
    height: 9,
    borderRadius: 2,
    backgroundColor: 'rgba(211, 35, 35, 0.7)',
  },
  overlayButtonText: {
    color: '#9f2424',
    fontSize: 10,
    fontWeight: '900',
  },
});
