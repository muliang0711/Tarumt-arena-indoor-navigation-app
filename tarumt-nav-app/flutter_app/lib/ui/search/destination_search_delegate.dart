import 'package:flutter/material.dart';
import 'package:indoor_navigation/domain/campus/campus_floor.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

abstract final class DestinationSearchKeys {
  static const empty = ValueKey<String>('destination-search.empty');

  static ValueKey<String> result(String roomId) =>
      ValueKey<String>('destination-search.result.$roomId');
}

List<CampusRoom> searchCampusDestinations({
  required List<CampusFloor> floors,
  required String query,
  required List<CampusRoom> rooms,
}) {
  final floorById = <String, CampusFloor>{
    for (final floor in floors) floor.id: floor,
  };
  final tokens = query
      .trim()
      .toLowerCase()
      .split(RegExp(r'\s+'))
      .where((token) => token.isNotEmpty)
      .toList(growable: false);
  final matches = rooms
      .where((room) {
        if (!room.navigationAvailable) return false;
        if (tokens.isEmpty) return true;
        final floor = floorById[room.floorId];
        final searchable = <String>[
          room.name,
          room.roomCode,
          room.typeLabel,
          floor?.name ?? '',
          floor?.code ?? '',
          ...?floor?.tags,
        ].join(' ').toLowerCase();
        return tokens.every(searchable.contains);
      })
      .toList(growable: false);
  matches.sort((left, right) {
    final floorComparison = left.floorId.compareTo(right.floorId);
    if (floorComparison != 0) return floorComparison;
    return left.roomCode.compareTo(right.roomCode);
  });
  return matches;
}

final class DestinationSearchDelegate extends SearchDelegate<CampusRoom?> {
  DestinationSearchDelegate({required this.floors, required this.rooms})
    : _floorById = <String, CampusFloor>{
        for (final floor in floors) floor.id: floor,
      },
      super(searchFieldLabel: 'Search rooms, codes or floors');

  final List<CampusFloor> floors;
  final List<CampusRoom> rooms;
  final Map<String, CampusFloor> _floorById;

  @override
  List<Widget> buildActions(BuildContext context) => [
    if (query.isNotEmpty)
      IconButton(
        tooltip: 'Clear search',
        onPressed: () => query = '',
        icon: const Icon(Icons.close),
      ),
  ];

  @override
  Widget buildLeading(BuildContext context) => IconButton(
    tooltip: 'Back',
    onPressed: () => close(context, null),
    icon: const Icon(Icons.arrow_back),
  );

  @override
  Widget buildResults(BuildContext context) => _buildMatches();

  @override
  Widget buildSuggestions(BuildContext context) => _buildMatches();

  Widget _buildMatches() {
    final matches = searchCampusDestinations(
      floors: floors,
      query: query,
      rooms: rooms,
    );
    if (matches.isEmpty) {
      return const Center(
        key: DestinationSearchKeys.empty,
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.search_off, size: 44),
              SizedBox(height: 12),
              Text('No navigable destinations match this search.'),
            ],
          ),
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 24),
      itemCount: matches.length,
      separatorBuilder: (_, _) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final room = matches[index];
        final floor = _floorById[room.floorId];
        return Card(
          margin: EdgeInsets.zero,
          color: CampusNavigatorColors.card,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(
              color: CampusNavigatorColors.border,
              width: 1.5,
            ),
          ),
          child: ListTile(
            key: DestinationSearchKeys.result(room.id),
            leading: const Icon(
              Icons.place_outlined,
              color: CampusNavigatorColors.accent,
            ),
            title: Text(
              '${room.roomCode} · ${room.name}',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            subtitle: Text(
              '${floor?.name ?? room.floorId} · ${room.typeLabel} · '
              '${room.walkMinutes} min walk',
            ),
            trailing: const Icon(Icons.arrow_forward_ios, size: 16),
            onTap: () => close(context, room),
          ),
        );
      },
    );
  }
}
