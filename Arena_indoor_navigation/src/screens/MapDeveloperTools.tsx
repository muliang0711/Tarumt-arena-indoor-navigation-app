import { Text, StyleSheet } from 'react-native';

import { DeveloperToolsPanel } from '../components/navigation/DeveloperToolsPanel';
import { colors } from '../components/theme';
import type { ArenaMapDeveloperToolsSnapshot } from '../mapEngine/map-controller';
import {
  MovementDebugPanel,
  NavigationDebugPanel,
} from '../mapEngine/debugger';
import type { MovementSensorDevControls } from '../sensors/useMovementSensors';
import { MovementSensorDevPanel } from '../sensors/useMovementSensors';

type MapDeveloperToolsProps = {
  controls: MovementSensorDevControls;
  expanded: boolean;
  onToggle: () => void;
  snapshot: ArenaMapDeveloperToolsSnapshot | null;
};

export function MapDeveloperTools({
  controls,
  expanded,
  onToggle,
  snapshot,
}: MapDeveloperToolsProps) {
  return (
    <DeveloperToolsPanel expanded={expanded} onToggle={onToggle}>
      <MovementSensorDevPanel controls={controls} embedded />
      {snapshot ? (
        <>
          <NavigationDebugPanel
            state={snapshot.navigationState}
            destinations={snapshot.selectableDestinations}
            onSelectDestination={snapshot.onSelectDestination}
            onCalculateRoute={snapshot.onCalculateRoute}
            onClearRoute={snapshot.onClearRoute}
            onToggleUnwalkable={snapshot.onToggleUnwalkable}
            embedded
          />
          <MovementDebugPanel
            snapshot={snapshot.debugSnapshot}
            onReset={snapshot.onResetNavigation}
            embedded
          />
        </>
      ) : (
        <Text style={styles.loadingText}>Waiting for developer diagnostics…</Text>
      )}
    </DeveloperToolsPanel>
  );
}

const styles = StyleSheet.create({
  loadingText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
});
