import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { OverlayRouteNode } from '../../tiled/type';

type MapRouteNodeProps = {
  node: OverlayRouteNode;
  onPress?: (node: OverlayRouteNode) => void;
  selected?: boolean;
};

export function MapRouteNode({
  node,
  onPress,
  selected = false,
}: MapRouteNodeProps) {
  const dotSize = selected ? 12 : 8;

  return (
    <Pressable
      accessibilityLabel={`Route node ${node.nodeId}`}
      accessibilityRole="button"
      disabled={!onPress}
      hitSlop={10}
      onPress={() => onPress?.(node)}
      style={[
        styles.nodePin,
        selected && styles.selectedNodePin,
        {
          left: node.screenX - dotSize / 2,
          top: node.screenY - dotSize / 2,
        },
      ]}
    >
      <View
        style={[
          styles.nodeDot,
          selected && styles.selectedNodeDot,
          {
            borderRadius: dotSize / 2,
            height: dotSize,
            width: dotSize,
          },
        ]}
      />
      <Text numberOfLines={1} style={styles.nodeLabel}>
        {node.nodeId}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nodePin: {
    alignItems: 'center',
    flexDirection: 'row',
    position: 'absolute',
  },
  selectedNodePin: {
    zIndex: 5,
  },
  nodeDot: {
    backgroundColor: '#ef4444',
    borderColor: '#ffffff',
    borderWidth: 1,
  },
  selectedNodeDot: {
    backgroundColor: '#0f766e',
    borderColor: '#ccfbf1',
    borderWidth: 2,
  },
  nodeLabel: {
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
    borderRadius: 4,
    color: '#ffffff',
    fontWeight: '700',
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
});
