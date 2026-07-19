enum CampusRoomCategory { classroom, facility, lab, restroom }

enum CampusRoomVisual {
  cafeteria,
  computerLab,
  generic,
  gym,
  lectureHall,
  library,
  researchLab,
  restroom,
}

final class CampusRoom {
  const CampusRoom({
    required this.category,
    required this.floorId,
    required this.id,
    required this.name,
    required this.roomCode,
    required this.typeLabel,
    required this.visual,
    required this.walkMinutes,
    this.navigationAvailable = true,
    this.navigationIssue,
    this.navigationNodeId,
  });

  final CampusRoomCategory category;
  final String floorId;
  final String id;
  final String name;
  final bool navigationAvailable;
  final String? navigationIssue;
  final String? navigationNodeId;
  final String roomCode;
  final String typeLabel;
  final CampusRoomVisual visual;
  final int walkMinutes;
}
