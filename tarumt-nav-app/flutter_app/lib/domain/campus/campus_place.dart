enum CampusPlaceKind {
  cafeteria,
  classroom,
  computerLab,
  facility,
  gym,
  library,
  restroom,
}

final class CampusPlace {
  const CampusPlace({
    required this.floor,
    required this.id,
    required this.kind,
    required this.name,
    required this.roomCode,
  });

  final int floor;
  final String id;
  final CampusPlaceKind kind;
  final String name;
  final String roomCode;

  String get locationLabel => 'Floor $floor · $roomCode';
}
