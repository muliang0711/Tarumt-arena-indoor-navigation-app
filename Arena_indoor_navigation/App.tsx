import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

import { PreviewTabs, ScreenKey } from './src/components/PreviewTabs';
import { FloorSelectionScreen } from './src/screens/FloorSelectionScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MapScreen } from './src/screens/MapScreen';
import { RoomSelectionScreen } from './src/screens/RoomSelectionScreen';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenKey>('home');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.app}>
        {activeScreen === 'home' && <HomeScreen onOpenFloors={() => setActiveScreen('floors')} />}
        {activeScreen === 'map' && <MapScreen />}
        {activeScreen === 'floors' && <FloorSelectionScreen onBack={() => setActiveScreen('home')} onChooseFloor={() => setActiveScreen('rooms')} />}
        {activeScreen === 'rooms' && <RoomSelectionScreen onBack={() => setActiveScreen('floors')} />}
      </View>
      <PreviewTabs activeScreen={activeScreen} onChange={setActiveScreen} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f2eb',
  },
  app: {
    flex: 1,
  },
});
