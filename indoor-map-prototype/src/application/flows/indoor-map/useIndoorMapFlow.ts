import { useEffect, useMemo, useState } from 'react';

import { getPrototypeFloor } from '../../../integration/map/loadPrototypeFloor';
import type {
  DestinationAnchor,
  DestinationFloorCatalog,
  FlowState,
  NavigationTelemetry,
  ParsedMapFloor,
  Point,
  RouteModel,
} from '../../../shared/types';
import {
  buildPrototypeScenario,
  buildRouteToDestination,
} from './navigationScenario';
import { useSensorRouteTracking } from './useSensorRouteTracking';

export type AppPage = 'home' | 'destination' | 'destination-rooms' | 'confirm' | 'map-overview' | 'map';

export interface IndoorMapFlowModel {
  page: AppPage;
  cameraGranted: boolean;
  mapState: FlowState;
  activeFloorId: string;
  floor: ParsedMapFloor;
  selectedDestinationFloor: DestinationFloorCatalog | null;
  selectedDestination: DestinationAnchor | null;
  route: RouteModel | null;
  routeProgress: number;
  scenario: ReturnType<typeof buildPrototypeScenario>;
  userPosition: Point;
  telemetry: NavigationTelemetry;
  actions: {
    requestCamera: () => void;
    startDestinationFlow: () => void;
    selectDestinationFloor: (floorId: string) => void;
    backToDestinationFloors: () => void;
    selectDestination: (destinationId: string) => void;
    confirmDestination: (destinationId: string) => void;
    openConfirm: () => void;
    openMapOverview: () => void;
    startNavigation: () => void;
    resetToHome: () => void;
    backFromMap: () => void;
    restartRoute: () => void;
    setActiveFloor: (floorId: string) => void;
  };
}

export function useIndoorMapFlow(): IndoorMapFlowModel {
  const floor = useMemo(() => getPrototypeFloor(), []);
  const scenario = useMemo(() => buildPrototypeScenario(floor), [floor]);

  const [page, setPage] = useState<AppPage>('home');
  const [cameraGranted, setCameraGranted] = useState(false);
  const [mapState, setMapState] = useState<FlowState>('detected');
  const [activeFloorId, setActiveFloorId] = useState(scenario.activeFloorId);
  const [selectedDestinationFloorId, setSelectedDestinationFloorId] = useState(
    scenario.destinationFloors.find((destinationFloor) => destinationFloor.availability === 'available')?.id ??
      scenario.destinationFloors[0]?.id ??
      '',
  );
  const [selectedDestinationId, setSelectedDestinationId] = useState(
    scenario.destinationFloors
      .find((destinationFloor) => destinationFloor.id === selectedDestinationFloorId)
      ?.categories[0]?.rooms[0]?.id ??
      scenario.destinations[0]?.id ??
      '',
  );

  const selectedDestinationFloor =
    scenario.destinationFloors.find((destinationFloor) => destinationFloor.id === selectedDestinationFloorId) ??
    null;

  const selectedDestination =
    scenario.destinations.find((destination) => destination.id === selectedDestinationId) ?? null;

  const route = useMemo(() => {
    if (!selectedDestination) {
      return null;
    }

    return buildRouteToDestination(scenario.currentPosition, selectedDestination, floor.tileSize);
  }, [floor.tileSize, scenario.currentPosition, selectedDestination]);

  const sensorTracking = useSensorRouteTracking({
    floor,
    route,
    enabled: page === 'map' && mapState === 'navigating',
    initialPosition: scenario.currentPosition,
  });

  const userPosition = useMemo(() => {
    if (!route || mapState === 'detected' || mapState === 'confirmed') {
      return scenario.currentPosition;
    }

    if (mapState === 'arrived') {
      return route.points[route.points.length - 1] ?? sensorTracking.userPosition;
    }

    return sensorTracking.userPosition;
  }, [mapState, route, scenario.currentPosition, sensorTracking.userPosition]);

  useEffect(() => {
    if (page !== 'map' || mapState !== 'navigating' || !sensorTracking.hasArrived) {
      return;
    }

    setMapState('arrived');
  }, [mapState, page, sensorTracking.hasArrived]);

  const requestCamera = () => setCameraGranted(true);

  const startDestinationFlow = () => {
    setPage('destination');
    setMapState('detected');
    sensorTracking.reset();
  };

  const selectDestinationFloor = (floorId: string) => {
    const targetFloor =
      scenario.destinationFloors.find((destinationFloor) => destinationFloor.id === floorId) ?? null;
    setSelectedDestinationFloorId(floorId);

    const firstRoom = targetFloor?.categories[0]?.rooms[0] ?? null;
    if (firstRoom) {
      setSelectedDestinationId(firstRoom.id);
      setActiveFloorId(floorId);
    }

    setPage('destination-rooms');
  };

  const backToDestinationFloors = () => {
    setPage('destination');
  };

  const selectDestination = (destinationId: string) => {
    setSelectedDestinationId(destinationId);
    const destination =
      scenario.destinations.find((candidate) => candidate.id === destinationId) ?? null;
    if (destination) {
      setSelectedDestinationFloorId(destination.floorId);
      setActiveFloorId(destination.floorId);
    }
  };

  const confirmDestination = (destinationId: string) => {
    const destination =
      scenario.destinations.find((candidate) => candidate.id === destinationId) ?? null;
    if (!destination) {
      return;
    }

    setSelectedDestinationId(destinationId);
    setSelectedDestinationFloorId(destination.floorId);
    setActiveFloorId(destination.floorId);
    setMapState('confirmed');
    setPage('confirm');
  };

  const openConfirm = () => {
    if (!selectedDestination) {
      return;
    }

    setPage('confirm');
  };

  const openMapOverview = () => {
    sensorTracking.reset();
    setPage('map-overview');
  };

  const startNavigation = () => {
    if (!selectedDestination || !route) {
      return;
    }

    setMapState('navigating');
    setPage('map');
    void sensorTracking.start();
  };

  const resetToHome = () => {
    sensorTracking.reset();
    setMapState('detected');
    setPage('home');
  };

  const backFromMap = () => {
    if (mapState === 'arrived') {
      resetToHome();
      return;
    }

    sensorTracking.reset();
    setMapState('confirmed');
    setPage('confirm');
  };

  const restartRoute = () => {
    sensorTracking.reset();
    setMapState('confirmed');
    setPage('destination');
  };

  return {
    page,
    cameraGranted,
    mapState,
    activeFloorId,
    floor,
    selectedDestinationFloor,
    selectedDestination,
    route,
    routeProgress: mapState === 'arrived' ? 1 : sensorTracking.routeProgress,
    scenario,
    userPosition,
    telemetry: sensorTracking.telemetry,
    actions: {
      requestCamera,
      startDestinationFlow,
      selectDestinationFloor,
      backToDestinationFloors,
      selectDestination,
      confirmDestination,
      openConfirm,
      openMapOverview,
      startNavigation,
      resetToHome,
      backFromMap,
      restartRoute,
      setActiveFloor: setActiveFloorId,
    },
  };
}
