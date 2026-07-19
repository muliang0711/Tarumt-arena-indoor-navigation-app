import { Image, ScrollView, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

import type { WrongWayRerouteResult } from '../../reroute';
import type {
  OverlayPathSegment,
  OverlayRouteNode,
  PngMapModel,
  RedMarkerState,
  RoutePosition,
} from '../../tiled/type';
import type { NavigationUiState } from '../../navigation';
import { InstructionBar, WrongWayWarningBanner } from '../navigation';
import { UserPresenceMarker } from './actor/UserPresenceMarker';
import { MapPathSegment } from './MapPathSegment';
import { MapRoomLabel } from './MapRoomLabel';
import { MapRouteNode } from './MapRouteNode';
import { RedMarker } from './RedMarker';

type IndoorMapViewportProps = {
  edgeSegments?: OverlayPathSegment[];
  blueMarkerPosition: RoutePosition;
  mapImage: ImageSourcePropType;
  mapModel: PngMapModel;
  navigation: NavigationUiState;
  observedHeadingDegrees?: number | null;
  onRouteNodePress?: (node: OverlayRouteNode) => void;
  redMarker: RedMarkerState;
  remainingPathSegments: OverlayPathSegment[];
  selectedRouteNodeIds?: string[];
  showNavigationOverlay?: boolean;
  wrongWayReroute?: WrongWayRerouteResult;
  zoom: number;
};

export function IndoorMapViewport({
  edgeSegments = [],
  blueMarkerPosition,
  mapImage,
  mapModel,
  navigation,
  observedHeadingDegrees,
  onRouteNodePress,
  redMarker,
  remainingPathSegments,
  selectedRouteNodeIds = [],
  showNavigationOverlay = true,
  wrongWayReroute,
  zoom,
}: IndoorMapViewportProps) {
  const selectedNodeIds = new Set(selectedRouteNodeIds);

  return (
    <View style={styles.viewportShell}>
      <ScrollView
        style={styles.verticalScroller}
        contentContainerStyle={styles.verticalContent}
        bounces={false}
      >
        <ScrollView horizontal bounces={false}>
          <View
            style={{
              height: mapModel.surface.height * zoom,
              width: mapModel.surface.width * zoom,
            }}
          >
            <View
              style={[
                styles.scaledMapLayer,
                {
                  height: mapModel.surface.height,
                  transform: [{ scale: zoom }],
                  width: mapModel.surface.width,
                },
              ]}
            >
              <Image
                resizeMode="stretch"
                source={mapImage}
                style={StyleSheet.absoluteFill}
              />
              {remainingPathSegments.map((segment) => (
                <MapPathSegment key={segment.key} segment={segment} />
              ))}
              {edgeSegments.map((segment) => (
                <MapPathSegment
                  color="rgba(15, 118, 110, 0.7)"
                  key={`edge-${segment.key}`}
                  segment={segment}
                />
              ))}
              {mapModel.roomLabels.map((label) => (
                <MapRoomLabel key={label.id} label={label} />
              ))}
              {mapModel.routeNodes.map((node) => (
                <MapRouteNode
                  key={node.id}
                  node={node}
                  onPress={onRouteNodePress}
                  selected={selectedNodeIds.has(node.nodeId)}
                />
              ))}
              {showNavigationOverlay ? (
                <>
                  <UserPresenceMarker
                    observedHeadingDegrees={observedHeadingDegrees}
                    position={blueMarkerPosition}
                  />
                  <RedMarker marker={redMarker} />
                </>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </ScrollView>
      {showNavigationOverlay ? (
        <View pointerEvents="box-none" style={styles.instructionOverlay}>
          {wrongWayReroute ? (
            <WrongWayWarningBanner result={wrongWayReroute} />
          ) : null}
          <InstructionBar navigation={navigation} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  viewportShell: {
    flex: 1,
    position: 'relative',
  },
  verticalScroller: {
    flex: 1,
  },
  verticalContent: {
    alignItems: 'flex-start',
    paddingBottom: 92,
  },
  instructionOverlay: {
    bottom: 0,
    left: 0,
    pointerEvents: 'box-none',
    position: 'absolute',
    right: 0,
  },
  scaledMapLayer: {
    left: 0,
    position: 'absolute',
    top: 0,
    transformOrigin: 'top left',
  },
});
