import { StyleSheet, Text, View } from 'react-native';

import { shadow } from '../theme';

type CompassWidgetProps = {
  rotationRadians?: number;
};

export function CompassWidget({ rotationRadians = 0 }: CompassWidgetProps) {
  return (
    <View style={styles.card} pointerEvents="none">
      <Text style={styles.north}>N</Text>
      <View
        style={[
          styles.needle,
          {
            transform: [{ rotate: `${rotationRadians}rad` }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.95)',
    ...shadow,
  },
  north: {
    position: 'absolute',
    top: 8,
    color: '#1f1a17',
    fontSize: 14,
    fontWeight: '900',
  },
  needle: {
    width: 0,
    height: 0,
    marginTop: 12,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 24,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#ff7417',
  },
});
