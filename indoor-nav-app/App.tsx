import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { activateKeepAwakeAsync } from 'expo-keep-awake';
import NavigationSplitPrototype from './src/screens/NavigationSplitPrototype';

activateKeepAwakeAsync();

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <NavigationSplitPrototype />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
});
