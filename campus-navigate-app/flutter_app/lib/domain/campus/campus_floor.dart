enum CampusFloorPlan { ground, second, third, fourth }

final class CampusFloor {
  const CampusFloor({
    required this.code,
    required this.id,
    required this.name,
    required this.plan,
    required this.summary,
    required this.tags,
    this.suggested = false,
  });

  final String code;
  final String id;
  final String name;
  final CampusFloorPlan plan;
  final bool suggested;
  final String summary;
  final List<String> tags;
}
