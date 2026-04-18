import React, { useEffect } from 'react';

import { useIndoorMapFlow } from '../../application/flows/indoor-map/useIndoorMapFlow';
import { DestinationStep } from './pages/DestinationStep';
import { DestinationFloorRoomsStep } from './pages/DestinationFloorRoomsStep';
import { ConfirmStep } from './pages/ConfirmStep';
import { HomeStep } from './pages/HomeStep';
import { NavigationMapStep } from './pages/NavigationMapStep';
import { useMapViewport } from '../hooks/useMapViewport';

export default function IndoorMapPrototypeScreen() {
  const {
    page,
    mapState,
    activeFloorId,
    floor,
    selectedDestinationFloor,
    selectedDestination,
    route,
    scenario,
    userPosition,
    telemetry,
    actions,
  } = useIndoorMapFlow();

  const { transform, onLayout, panHandlers, zoomBy, centerOn, fitToBounds } = useMapViewport({
    worldWidth: floor.worldWidth,
    worldHeight: floor.worldHeight,
    focusBounds: floor.focusBounds,
  });

  useEffect(() => {
    if (page !== 'map') {
      return;
    }

    fitToBounds();
  }, [fitToBounds, page]);

  useEffect(() => {
    if (page !== 'map' || !selectedDestination) {
      return;
    }

    centerOn(selectedDestination.roomCenter, mapState === 'navigating' ? 1.25 : 1.08);
  }, [centerOn, mapState, page, selectedDestination]);

  if (page === 'home') {
    return (
      <HomeStep
        currentLocationLabel={scenario.currentLocationLabel}
        onStartNavigation={actions.startDestinationFlow}
      />
    );
  }

  if (page === 'destination') {
    return (
      <DestinationStep
        floors={scenario.destinationFloors}
        selectedFloorId={selectedDestinationFloor?.id ?? null}
        onBack={actions.resetToHome}
        onSelectFloor={actions.selectDestinationFloor}
      />
    );
  }

  if (page === 'destination-rooms' && selectedDestinationFloor) {
    return (
      <DestinationFloorRoomsStep
        floor={selectedDestinationFloor}
        selectedDestinationId={selectedDestination?.id ?? null}
        onBack={actions.backToDestinationFloors}
        onSelectDestination={actions.selectDestination}
        onContinue={actions.openConfirm}
      />
    );
  }

  if (page === 'confirm') {
    return (
      <ConfirmStep
        buildingName={scenario.buildingName}
        currentLocationLabel={scenario.currentLocationLabel}
        floorLabel={selectedDestination?.floorLabel ?? floor.label}
        route={route}
        selectedDestination={selectedDestination}
        onChooseAnother={actions.restartRoute}
        onOpenMap={actions.startNavigation}
      />
    );
  }

  return (
    <NavigationMapStep
      activeFloorId={activeFloorId}
      floor={floor}
      floors={scenario.floors}
      mapState={mapState}
      route={route}
      selectedDestination={selectedDestination}
      transform={transform}
      userPosition={userPosition}
      telemetry={telemetry}
      panHandlers={panHandlers}
      onLayout={onLayout}
      onBack={actions.backFromMap}
      onSelectFloor={actions.setActiveFloor}
      onZoomIn={() => zoomBy(0.22)}
      onZoomOut={() => zoomBy(-0.22)}
      onRecenter={() => centerOn(userPosition, Math.max(transform.scale, 1.08))}
      onEnd={actions.resetToHome}
      onNewRoute={actions.restartRoute}
    />
  );
}
