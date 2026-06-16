import { ReactNode } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { radius } from '../../components/theme';
import { CameraState } from './cameraModel';

type CameraViewportProps = {
  camera: CameraState;
  contentWidth: number;
  contentHeight: number;
  height: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  children: ReactNode;
};

export function CameraViewport({ camera, contentWidth, contentHeight, height, onLayout, children }: CameraViewportProps) {
  return (
    <View style={[styles.viewport, { height }]} onLayout={onLayout}>
      <View
        style={[
          styles.stage,
          {
            width: contentWidth,
            height: contentHeight,
            transform: [
              { translateX: camera.offsetX },
              { translateY: camera.offsetY },
              { scale: camera.scale },
            ],
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    overflow: 'hidden',
    borderRadius: radius.md,
    backgroundColor: '#1f2933',
  },
  stage: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: '#f5f4ef',
  },
});
