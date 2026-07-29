import 'package:indoor_navigation/application/ports/maps/map_runtime_resource_repository.dart';
import 'package:indoor_navigation/application/view_models/view_model_models.dart';
import 'package:indoor_navigation/domain/campus/campus_floor.dart';
import 'package:indoor_navigation/domain/presence/presence_connection.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

enum LiveMapLoadStatus { idle, loading, ready, error }

const liveMapDemoFloorId = 'floor-2';

final class LiveMapViewState {
  LiveMapViewState({
    required this.buildingId,
    required this.buildingName,
    required List<CampusFloor> floors,
    required this.isUsingSimulatedPresence,
    required this.loadError,
    required this.loadStatus,
    required this.mapImage,
    required this.mapModel,
    required this.presenceConnection,
    required this.selectedFloorId,
    required this.snapshot,
    required this.zoom,
  }) : floors = List.unmodifiable(floors);

  factory LiveMapViewState.initial({
    required String buildingId,
    required String buildingName,
    required List<CampusFloor> floors,
    String selectedFloorId = liveMapDemoFloorId,
    bool isUsingSimulatedPresence = true,
    PresenceConnectionState? presenceConnection,
  }) => LiveMapViewState(
    buildingId: buildingId,
    buildingName: buildingName,
    floors: floors,
    isUsingSimulatedPresence: isUsingSimulatedPresence,
    loadError: null,
    loadStatus: LiveMapLoadStatus.idle,
    mapImage: null,
    mapModel: null,
    presenceConnection:
        presenceConnection ??
        (isUsingSimulatedPresence
            ? const PresenceConnectionState.simulated()
            : const PresenceConnectionState.disconnected()),
    selectedFloorId: selectedFloorId,
    snapshot: null,
    zoom: indoorNavigationZoomAt(indoorNavigationDefaultZoomIndex),
  );

  final String buildingId;
  final String buildingName;
  final List<CampusFloor> floors;
  final bool isUsingSimulatedPresence;
  final Object? loadError;
  final LiveMapLoadStatus loadStatus;
  final MapImageLocation? mapImage;
  final PngMapModel? mapModel;
  final PresenceConnectionState presenceConnection;
  final String selectedFloorId;
  final PresenceSnapshot? snapshot;
  final double zoom;

  CampusFloor get selectedFloor =>
      floors.firstWhere((floor) => floor.id == selectedFloorId);

  bool get hasMapForSelectedFloor =>
      selectedFloorId == liveMapDemoFloorId && mapModel != null;

  LiveMapViewState copyWith({
    bool clearLoadError = false,
    bool clearSnapshot = false,
    bool? isUsingSimulatedPresence,
    Object? loadError,
    LiveMapLoadStatus? loadStatus,
    MapImageLocation? mapImage,
    PngMapModel? mapModel,
    PresenceConnectionState? presenceConnection,
    String? selectedFloorId,
    PresenceSnapshot? snapshot,
    double? zoom,
  }) => LiveMapViewState(
    buildingId: buildingId,
    buildingName: buildingName,
    floors: floors,
    isUsingSimulatedPresence:
        isUsingSimulatedPresence ?? this.isUsingSimulatedPresence,
    loadError: clearLoadError ? null : loadError ?? this.loadError,
    loadStatus: loadStatus ?? this.loadStatus,
    mapImage: mapImage ?? this.mapImage,
    mapModel: mapModel ?? this.mapModel,
    presenceConnection: presenceConnection ?? this.presenceConnection,
    selectedFloorId: selectedFloorId ?? this.selectedFloorId,
    snapshot: clearSnapshot ? null : snapshot ?? this.snapshot,
    zoom: zoom ?? this.zoom,
  );
}
