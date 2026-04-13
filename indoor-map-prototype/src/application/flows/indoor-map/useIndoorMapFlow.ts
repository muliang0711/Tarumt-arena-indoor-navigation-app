import { useEffect, useMemo, useState } from 'react';

import { getPrototypeFloor } from '../../../integration/map/loadPrototypeFloor';
import type {
  DestinationAnchor,
  FlowState,
  ParsedMapFloor,
  Point,
  RouteModel,
} from '../../../shared/types';
import {
  buildPrototypeScenario,
  buildRouteToDestination,
  interpolateRoutePosition,
} from './navigationScenario';

export type AppPage = 'home' | 'destination' | 'confirm' | 'map';

export interface IndoorMapFlowModel {
  page: AppPage;
  cameraGranted: boolean;
  mapState: FlowState;
  activeFloorId: string;
  floor: ParsedMapFloor;
  selectedDestination: DestinationAnchor | null;
  route: RouteModel | null;
  routeProgress: number;
  scenario: ReturnType<typeof buildPrototypeScenario>;
  userPosition: Point;
  actions: {
    requestCamera: () => void;
    startDestinationFlow: () => void;
    selectDestination: (destinationId: string) => void;
    openConfirm: () => void;
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
  const [selectedDestinationId, setSelectedDestinationId] = useState(
    scenario.destinations[1]?.id ?? scenario.destinations[0]?.id ?? '',
  );
  const [routeProgress, setRouteProgress] = useState(0);

  const selectedDestination =
    scenario.destinations.find((destination) => destination.id === selectedDestinationId) ?? null;

  const route = useMemo(() => {
    if (!selectedDestination) {
      return null;
    }

    return buildRouteToDestination(scenario.currentPosition, selectedDestination, floor.tileSize);
  }, [floor.tileSize, scenario.currentPosition, selectedDestination]);

  const userPosition = useMemo(() => {
    if (!route || mapState === 'detected' || mapState === 'confirmed') {
      return scenario.currentPosition;
    }

    return interpolateRoutePosition(route.points, mapState === 'arrived' ? 1 : routeProgress);
  }, [mapState, route, routeProgress, scenario.currentPosition]);

  useEffect(() => {
    if (page !== 'map' || mapState !== 'navigating') {
      return;
    }

    const timer = setInterval(() => {
      setRouteProgress((current) => {
        const next = Math.min(current + 0.018, 1);
        if (next >= 1) {
          setMapState('arrived');
        }
        return next;
      });
    }, 120);

    return () => clearInterval(timer);
  }, [mapState, page]);

  const requestCamera = () => setCameraGranted(true);

  const startDestinationFlow = () => {
    setPage('destination');
    setMapState('detected');
    setRouteProgress(0);
  };

  const selectDestination = (destinationId: string) => {
    setSelectedDestinationId(destinationId);
  };

  const openConfirm = () => {
    if (!selectedDestination) {
      return;
    }

    setPage('confirm');
  };

  const startNavigation = () => {
    if (!selectedDestination || !route) {
      return;
    }

    setRouteProgress(0);
    setMapState('navigating');
    setPage('map');
  };

  const resetToHome = () => {
    setRouteProgress(0);
    setMapState('detected');
    setPage('home');
  };

  const backFromMap = () => {
    if (mapState === 'arrived') {
      resetToHome();
      return;
    }

    setMapState('confirmed');
    setPage('confirm');
  };

  const restartRoute = () => {
    setRouteProgress(0);
    setMapState('confirmed');
    setPage('destination');
  };

  return {
    page,
    cameraGranted,
    mapState,
    activeFloorId,
    floor,
    selectedDestination,
    route,
    routeProgress,
    scenario,
    userPosition,
    actions: {
      requestCamera,
      startDestinationFlow,
      selectDestination,
      openConfirm,
      startNavigation,
      resetToHome,
      backFromMap,
      restartRoute,
      setActiveFloor: setActiveFloorId,
    },
  };
}
