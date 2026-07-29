import 'package:indoor_navigation/domain/campus/campus_catalog_models.dart';
import 'package:indoor_navigation/domain/campus/campus_place.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';

enum HomeQuickAccessTarget { selectFloor, selectRoom, recentPlaces, settings }

final class HomeQuickAccessItem {
  const HomeQuickAccessItem({
    required this.subtitle,
    required this.target,
    required this.title,
  });

  final String subtitle;
  final HomeQuickAccessTarget target;
  final String title;
}

final class HomeViewState {
  const HomeViewState({
    required this.popularPlaces,
    required this.quickAccessItems,
    required this.recentVisitCount,
  });

  final List<CampusPlace> popularPlaces;
  final List<HomeQuickAccessItem> quickAccessItems;
  final int recentVisitCount;
}

const defaultHomeViewState = HomeViewState(
  popularPlaces: [
    CampusPlace(
      floor: 3,
      id: 'library-l305',
      kind: CampusPlaceKind.library,
      name: 'Library',
      roomCode: 'L305',
    ),
    CampusPlace(
      floor: 3,
      id: 'computer-lab-c301',
      kind: CampusPlaceKind.computerLab,
      name: 'Computer Lab',
      roomCode: 'C301',
    ),
    CampusPlace(
      floor: 2,
      id: 'gym-g201',
      kind: CampusPlaceKind.gym,
      name: 'Gym',
      roomCode: 'G201',
    ),
    CampusPlace(
      floor: 1,
      id: 'cafeteria-cf101',
      kind: CampusPlaceKind.cafeteria,
      name: 'Cafeteria',
      roomCode: 'CF101',
    ),
  ],
  quickAccessItems: [
    HomeQuickAccessItem(
      subtitle: 'Browse all floors',
      target: HomeQuickAccessTarget.selectFloor,
      title: 'Select Floor',
    ),
    HomeQuickAccessItem(
      subtitle: 'Find a room',
      target: HomeQuickAccessTarget.selectRoom,
      title: 'Select Room',
    ),
    HomeQuickAccessItem(
      subtitle: '3 recent visits',
      target: HomeQuickAccessTarget.recentPlaces,
      title: 'Recent Places',
    ),
    HomeQuickAccessItem(
      subtitle: 'App preferences',
      target: HomeQuickAccessTarget.settings,
      title: 'Settings',
    ),
  ],
  recentVisitCount: 3,
);

final class HomeViewModel {
  const HomeViewModel({this.state = defaultHomeViewState});

  factory HomeViewModel.fromCatalog(CampusCatalog catalog) {
    final popularPlaces = catalog.rooms
        .where((room) => room.navigationAvailable)
        .take(4)
        .map(
          (room) => CampusPlace(
            floor: _floorNumber(room.floorId),
            id: room.id,
            kind: _placeKind(room),
            name: room.name,
            roomCode: room.roomCode,
          ),
        )
        .toList(growable: false);
    return HomeViewModel(
      state: HomeViewState(
        popularPlaces: popularPlaces,
        quickAccessItems: defaultHomeViewState.quickAccessItems,
        recentVisitCount: 0,
      ),
    );
  }

  final HomeViewState state;
}

int _floorNumber(String floorId) {
  final value = int.tryParse(floorId.split('-').last);
  if (value == null) {
    throw StateError('Campus floor id must end with a number: $floorId');
  }
  return value;
}

CampusPlaceKind _placeKind(CampusRoom room) {
  return switch (room.visual) {
    CampusRoomVisual.cafeteria => CampusPlaceKind.cafeteria,
    CampusRoomVisual.computerLab => CampusPlaceKind.computerLab,
    CampusRoomVisual.gym => CampusPlaceKind.gym,
    CampusRoomVisual.library => CampusPlaceKind.library,
    CampusRoomVisual.restroom => CampusPlaceKind.restroom,
    CampusRoomVisual.generic => CampusPlaceKind.facility,
    CampusRoomVisual.lectureHall ||
    CampusRoomVisual.researchLab => CampusPlaceKind.classroom,
  };
}
