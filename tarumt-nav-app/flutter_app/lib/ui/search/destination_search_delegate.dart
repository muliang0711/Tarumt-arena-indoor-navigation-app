import 'package:flutter/material.dart';
import 'package:indoor_navigation/domain/campus/campus_floor.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

abstract final class DestinationSearchKeys {
  static const empty = ValueKey<String>('destination-search.empty');

  static ValueKey<String> navigate(String roomId) =>
      ValueKey<String>('destination-search.navigate.$roomId');

  static ValueKey<String> result(String roomId) =>
      ValueKey<String>('destination-search.result.$roomId');

  static ValueKey<String> save(String roomId) =>
      ValueKey<String>('destination-search.save.$roomId');
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
  DestinationSearchDelegate({
    required this.floors,
    required this.onToggleSaved,
    required this.rooms,
    required Iterable<String> savedRoomIds,
  }) : _savedRoomIds = savedRoomIds.toSet(),
       _floorById = <String, CampusFloor>{
         for (final floor in floors) floor.id: floor,
       },
       super(searchFieldLabel: 'Search rooms, codes or floors');

  final List<CampusFloor> floors;
  final List<CampusRoom> rooms;
  final Map<String, CampusFloor> _floorById;
  final ValueChanged<String> onToggleSaved;
  final Set<String> _savedRoomIds;

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
        return StatefulBuilder(
          builder: (context, setResultState) {
            final isSaved = _savedRoomIds.contains(room.id);
            return Card(
              key: DestinationSearchKeys.result(room.id),
              margin: EdgeInsets.zero,
              color: CampusNavigatorColors.card,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(
                  color: CampusNavigatorColors.border,
                  width: 1.5,
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
                child: Row(
                  children: [
                    const Icon(
                      Icons.place_outlined,
                      color: CampusNavigatorColors.accent,
                      size: 28,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${room.roomCode} · ${room.name}',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '${floor?.name ?? room.floorId} · ${room.typeLabel}',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${room.walkMinutes} min walk',
                            style: const TextStyle(
                              color: CampusNavigatorColors.textMuted,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 6),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          key: DestinationSearchKeys.save(room.id),
                          onPressed: () {
                            onToggleSaved(room.id);
                            setResultState(() {
                              if (isSaved) {
                                _savedRoomIds.remove(room.id);
                              } else {
                                _savedRoomIds.add(room.id);
                              }
                            });
                          },
                          tooltip: isSaved
                              ? 'Remove ${room.name} from Saved'
                              : 'Save ${room.name}',
                          visualDensity: VisualDensity.compact,
                          icon: Icon(
                            isSaved ? Icons.bookmark : Icons.bookmark_border,
                            color: isSaved
                                ? CampusNavigatorColors.accent
                                : CampusNavigatorColors.textMuted,
                          ),
                        ),
                        SizedBox(
                          height: 40,
                          child: FilledButton(
                            key: DestinationSearchKeys.navigate(room.id),
                            onPressed: () => close(context, room),
                            style: FilledButton.styleFrom(
                              backgroundColor:
                                  CampusNavigatorColors.accentBright,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                              textStyle: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            child: const Text('Navigate'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}
