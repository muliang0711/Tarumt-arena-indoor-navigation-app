import React from 'react';
import { GestureResponderHandlers, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Image as SvgImage,
  Line,
  Pattern,
  Polygon,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

import { colors } from '../../../shared/theme/tokens';
import type {
  DestinationAnchor,
  FlowState,
  ParsedMapFloor,
  Point,
  RouteModel,
  TransformState,
} from '../../../shared/types';

interface IndoorMapCanvasProps {
  floor: ParsedMapFloor;
  state: FlowState;
  transform: TransformState;
  userPosition: Point;
  headingDegrees: number | null;
  selectedDestination: DestinationAnchor | null;
  route: RouteModel | null;
  panHandlers: GestureResponderHandlers;
  onLayout: (event: any) => void;
}

function pointsToSvgPolyline(points: Point[]) {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

function sanitizePatternId(assetId: string) {
  return assetId.replace(/[^a-z0-9]/gi, '-');
}

export default function IndoorMapCanvas({
  floor,
  state,
  transform,
  userPosition,
  headingDegrees,
  selectedDestination,
  route,
  panHandlers,
  onLayout,
}: IndoorMapCanvasProps) {
  const blockedPatternId = floor.background.blocked
    ? sanitizePatternId(floor.background.blocked.assetId)
    : null;
  const arrowRotation = headingDegrees ?? 0;

  return (
    <View style={styles.canvasShell} onLayout={onLayout} {...panHandlers}>
      <Svg width="100%" height="100%">
        <Defs>
          {floor.background.blocked ? (
            <Pattern
              id={blockedPatternId ?? 'blocked-pattern'}
              width={floor.tileSize}
              height={floor.tileSize}
              patternUnits="userSpaceOnUse"
            >
              <SvgImage
                x={0}
                y={0}
                width={floor.tileSize}
                height={floor.tileSize}
                href={floor.background.blocked.uri}
                preserveAspectRatio="none"
              />
            </Pattern>
          ) : null}
        </Defs>

        <Rect width="100%" height="100%" fill={colors.mapChrome} />

        <G
          transform={`translate(${transform.translateX} ${transform.translateY}) scale(${transform.scale})`}
        >
          <Rect
            x={0}
            y={0}
            width={floor.worldWidth}
            height={floor.worldHeight}
            fill={blockedPatternId ? `url(#${blockedPatternId})` : colors.mapBackdrop}
          />

          <Rect
            x={floor.focusBounds.x}
            y={floor.focusBounds.y}
            width={floor.focusBounds.width}
            height={floor.focusBounds.height}
            fill="rgba(255,255,255,0.15)"
            stroke={colors.mapFrame}
            strokeWidth={2}
            rx={28}
          />

          {floor.resolvedTiles.map((tile) => {
            if (!tile.sprite) {
              return null;
            }

            return (
              <SvgImage
                key={tile.key}
                x={tile.x}
                y={tile.y}
                width={tile.width}
                height={tile.height}
                href={tile.sprite.uri}
                opacity={0.85}
                preserveAspectRatio="none"
              />
            );
          })}

          {floor.roads.map((road) => (
            <SvgImage
              key={road.id}
              x={road.x}
              y={road.y}
              width={road.width}
              height={road.height}
              href={road.sprite.uri}
              preserveAspectRatio="none"
            />
          ))}

          {selectedDestination ? (
            <Rect
              x={selectedDestination.roomBounds.x - 10}
              y={selectedDestination.roomBounds.y - 10}
              width={selectedDestination.roomBounds.width + 20}
              height={selectedDestination.roomBounds.height + 20}
              rx={24}
              fill={selectedDestination.accentColor}
              opacity={0.12}
              stroke={selectedDestination.accentColor}
              strokeWidth={3}
            />
          ) : null}

          {floor.rooms.map((room) => (
            <SvgImage
              key={room.id}
              x={room.x}
              y={room.y}
              width={room.width}
              height={room.height}
              href={room.sprite.uri}
              preserveAspectRatio="none"
            />
          ))}

          {selectedDestination ? (
            <G>
              {state !== 'navigating' ? (
                <Line
                  x1={selectedDestination.entrance.x}
                  y1={selectedDestination.entrance.y}
                  x2={selectedDestination.roomCenter.x}
                  y2={selectedDestination.roomCenter.y}
                  stroke={selectedDestination.accentColor}
                  strokeWidth={4}
                  strokeDasharray="10 8"
                  opacity={0.45}
                />
              ) : null}
              <Circle
                cx={selectedDestination.roomCenter.x}
                cy={selectedDestination.roomCenter.y}
                r={state === 'navigating' ? 14 : 18}
                fill={selectedDestination.accentColor}
              />
              <Circle
                cx={selectedDestination.roomCenter.x}
                cy={selectedDestination.roomCenter.y}
                r={8}
                fill={colors.white}
              />
              {state !== 'navigating' ? (
                <SvgText
                  x={selectedDestination.roomCenter.x}
                  y={selectedDestination.roomBounds.y - 18}
                  textAnchor="middle"
                  fontSize={18}
                  fontWeight="700"
                  fill={colors.textPrimary}
                >
                  {selectedDestination.label}
                </SvgText>
              ) : null}
            </G>
          ) : null}

          {route && (state === 'navigating' || state === 'arrived') ? (
            <G>
              <Polyline
                points={pointsToSvgPolyline(route.points)}
                fill="none"
                stroke={colors.routeGlow}
                strokeWidth={22}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Polyline
                points={pointsToSvgPolyline(route.points)}
                fill="none"
                stroke={colors.route}
                strokeWidth={10}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </G>
          ) : null}

          <G>
            <Circle cx={userPosition.x} cy={userPosition.y} r={24} fill={colors.userRing} />
            <G transform={`translate(${userPosition.x} ${userPosition.y}) rotate(${arrowRotation})`}>
              <Circle cx={0} cy={0} r={12} fill={colors.white} />
              <Polygon
                points="0,-18 12,12 4,9 0,16 -4,9 -12,12"
                fill={colors.userDot}
                stroke={colors.white}
                strokeWidth={2}
                strokeLinejoin="round"
              />
            </G>
          </G>

          {state === 'detected' ? (
            <Circle
              cx={userPosition.x}
              cy={userPosition.y}
              r={38}
              fill="none"
              stroke={colors.detectionDot}
              strokeWidth={4}
              strokeDasharray="8 8"
              opacity={0.72}
            />
          ) : null}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  canvasShell: {
    flex: 1,
  },
});
