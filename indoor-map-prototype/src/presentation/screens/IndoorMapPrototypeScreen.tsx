import React, { useEffect } from 'react';

import type { AppPage } from '../../application/flows/indoor-map/useIndoorMapFlow';
import { useIndoorMapFlow } from '../../application/flows/indoor-map/useIndoorMapFlow';
import { DestinationStep } from './pages/DestinationStep';
import { DestinationFloorRoomsStep } from './pages/DestinationFloorRoomsStep';
import { ConfirmStep } from './pages/ConfirmStep';
import { HomeStep } from './pages/HomeStep';
import { MapOverviewStep } from './pages/MapOverviewStep';
import { NavigationMapStep } from './pages/NavigationMapStep';
import { useMapViewport } from '../hooks/useMapViewport';

function isMapLikePage(page: AppPage) {
  return page === 'map' || page === 'map-overview';
}

export default function IndoorMapPrototypeScreen() {
  const {
    page,
    mapState,
    activeFloorId,
    floor,
    selectedDestinationFloor,
    selectedDestination,
    route,
    routeProgress,
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
    if (!isMapLikePage(page)) {
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

  function renderPage(targetPage: AppPage) {
    switch (targetPage) {
      case 'home':
        return (
          <HomeStep
            currentLocationLabel={scenario.currentLocationLabel}
            onStartNavigation={actions.startDestinationFlow}
            onOpenMapOverview={actions.openMapOverview}
            onScanAnchor={actions.requestCamera}
          />
        );
      case 'destination':
        return (
          <DestinationStep
            floors={scenario.destinationFloors}
            selectedFloorId={selectedDestinationFloor?.id ?? null}
            onBack={actions.resetToHome}
            onOpenMapOverview={actions.openMapOverview}
            onSelectFloor={actions.selectDestinationFloor}
            onConfirmDestination={actions.confirmDestination}
          />
        );
      case 'destination-rooms':
        if (!selectedDestinationFloor) {
          return null;
        }

        return (
          <DestinationFloorRoomsStep
            floor={selectedDestinationFloor}
            selectedDestinationId={selectedDestination?.id ?? null}
            onBack={actions.backToDestinationFloors}
            onOpenMapOverview={actions.openMapOverview}
            onGoHome={actions.resetToHome}
            onSelectDestination={actions.selectDestination}
            onContinue={actions.openConfirm}
          />
        );
      case 'confirm':
        return (
          <ConfirmStep
            buildingName={scenario.buildingName}
            currentLocationLabel={scenario.currentLocationLabel}
            floorLabel={selectedDestination?.floorLabel ?? floor.label}
            route={route}
            selectedDestination={selectedDestination}
            onGoHome={actions.resetToHome}
            onChooseAnother={actions.restartRoute}
            onOpenOverviewMap={actions.openMapOverview}
            onOpenMap={actions.startNavigation}
          />
        );
      case 'map-overview':
        return (
          <MapOverviewStep
            activeFloorId={activeFloorId}
            floor={floor}
            floors={scenario.floors}
            transform={transform}
            userPosition={userPosition}
            headingDegrees={telemetry.headingDegrees}
            panHandlers={panHandlers}
            onLayout={onLayout}
            onGoHome={actions.resetToHome}
            onStart={actions.startDestinationFlow}
            onSelectFloor={actions.setActiveFloor}
          />
        );
      case 'map':
        return (
          <NavigationMapStep
            activeFloorId={activeFloorId}
            floor={floor}
            floors={scenario.floors}
            mapState={mapState}
            route={route}
            routeProgress={routeProgress}
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
  }

  return renderPage(page);
}
