import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Orbitron_800ExtraBold, useFonts } from '@expo-google-fonts/orbitron';

import IndoorMapPrototypeScreen from './src/presentation/screens/IndoorMapPrototypeScreen';
import { colors } from './src/shared/theme/tokens';

export default function App() {
  const [fontsLoaded] = useFonts({
    Orbitron_800ExtraBold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.appShell}>
      <StatusBar style="light" />
      <View style={styles.phoneFrame}>
        <IndoorMapPrototypeScreen />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: colors.shellBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    backgroundColor: colors.mapChrome,
    overflow: 'hidden',
  },
});
