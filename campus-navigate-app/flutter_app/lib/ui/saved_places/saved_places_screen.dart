import 'dart:async';

import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/view_models/floor_rooms_view_model.dart';
import 'package:indoor_navigation/domain/campus/campus_floor.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

abstract final class SavedPlacesScreenKeys {
  static const browseRooms = ValueKey<String>('saved-places.browse-rooms');
  static const empty = ValueKey<String>('saved-places.empty');
  static const screen = ValueKey<String>('app-section.saved');

  static ValueKey<String> navigate(String roomId) =>
      ValueKey<String>('saved-places.navigate.$roomId');

  static ValueKey<String> remove(String roomId) =>
      ValueKey<String>('saved-places.remove.$roomId');

  static ValueKey<String> room(String roomId) =>
      ValueKey<String>('saved-places.room.$roomId');
}

final class SavedPlacesScreen extends StatefulWidget {
  const SavedPlacesScreen({
    required this.onBrowseRooms,
    required this.onNavigate,
    required this.viewModel,
    super.key,
  });

  final VoidCallback onBrowseRooms;
  final ValueChanged<CampusRoom> onNavigate;
  final FloorRoomsViewModel viewModel;

  @override
  State<SavedPlacesScreen> createState() => _SavedPlacesScreenState();
}

final class _SavedPlacesScreenState extends State<SavedPlacesScreen> {
  late FloorRoomsViewState _state;
  late final StreamSubscription<FloorRoomsViewState> _subscription;

  @override
  void initState() {
    super.initState();
    _state = widget.viewModel.state;
    _subscription = widget.viewModel.states.listen((state) {
      if (mounted) {
        setState(() => _state = state);
      }
    });
  }

  @override
  void dispose() {
    unawaited(_subscription.cancel());
    super.dispose();
  }

  CampusFloor _floorFor(CampusRoom room) =>
      _state.floors.firstWhere((floor) => floor.id == room.floorId);

  @override
  Widget build(BuildContext context) {
    final savedRooms = _state.savedRooms;
    return ColoredBox(
      color: CampusNavigatorColors.background,
      child: SafeArea(
        bottom: false,
        child: CustomScrollView(
          key: SavedPlacesScreenKeys.screen,
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(14, 18, 14, 28),
              sliver: SliverList.list(
                children: [
                  _Header(savedCount: savedRooms.length),
                  const SizedBox(height: 18),
                  if (savedRooms.isEmpty)
                    _EmptySavedPlaces(onBrowseRooms: widget.onBrowseRooms)
                  else ...[
                    const Text(
                      'Your Places',
                      style: TextStyle(
                        color: CampusNavigatorColors.text,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 10),
                    for (var index = 0; index < savedRooms.length; index++) ...[
                      _SavedRoomCard(
                        floor: _floorFor(savedRooms[index]),
                        onNavigate: () => widget.onNavigate(savedRooms[index]),
                        onRemove: () => widget.viewModel.toggleSavedRoom(
                          savedRooms[index].id,
                        ),
                        room: savedRooms[index],
                      ),
                      if (index != savedRooms.length - 1)
                        const SizedBox(height: 12),
                    ],
                    const SizedBox(height: 18),
                    OutlinedButton.icon(
                      key: SavedPlacesScreenKeys.browseRooms,
                      onPressed: widget.onBrowseRooms,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: CampusNavigatorColors.accent,
                        minimumSize: const Size.fromHeight(48),
                        side: const BorderSide(
                          color: CampusNavigatorColors.accent,
                          width: 1.5,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      icon: const Icon(Icons.search),
                      label: const Text(
                        'Browse more rooms',
                        style: TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

final class _Header extends StatelessWidget {
  const _Header({required this.savedCount});

  final int savedCount;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Saved Places',
                style: TextStyle(
                  color: CampusNavigatorColors.text,
                  fontFamily: 'monospace',
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.4,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                savedCount == 1
                    ? '1 bookmarked destination'
                    : '$savedCount bookmarked destinations',
                style: const TextStyle(
                  color: CampusNavigatorColors.textMuted,
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        Container(
          height: 52,
          width: 52,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: CampusNavigatorColors.text,
            borderRadius: BorderRadius.circular(12),
            boxShadow: const [
              BoxShadow(
                color: CampusNavigatorColors.shadow,
                offset: Offset(3, 4),
              ),
            ],
          ),
          child: const Icon(
            Icons.bookmark,
            color: CampusNavigatorColors.card,
            size: 29,
          ),
        ),
      ],
    );
  }
}

final class _EmptySavedPlaces extends StatelessWidget {
  const _EmptySavedPlaces({required this.onBrowseRooms});

  final VoidCallback onBrowseRooms;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: SavedPlacesScreenKeys.empty,
      padding: const EdgeInsets.fromLTRB(24, 42, 24, 34),
      decoration: BoxDecoration(
        color: CampusNavigatorColors.card,
        border: Border.all(color: CampusNavigatorColors.border, width: 1.8),
        borderRadius: BorderRadius.circular(13),
        boxShadow: const [
          BoxShadow(color: CampusNavigatorColors.shadow, offset: Offset(4, 5)),
        ],
      ),
      child: Column(
        children: [
          Container(
            height: 68,
            width: 68,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFFF8EEE7),
              border: Border.all(color: CampusNavigatorColors.border),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(
              Icons.bookmark_add_outlined,
              color: CampusNavigatorColors.accent,
              size: 36,
            ),
          ),
          const SizedBox(height: 18),
          const Text(
            'No saved places yet',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: CampusNavigatorColors.text,
              fontSize: 20,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 7),
          const Text(
            'Bookmark a room to keep it close for your next visit.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: CampusNavigatorColors.textMuted,
              fontSize: 14,
              fontWeight: FontWeight.w500,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
            key: SavedPlacesScreenKeys.browseRooms,
            onPressed: onBrowseRooms,
            style: FilledButton.styleFrom(
              backgroundColor: CampusNavigatorColors.accentBright,
              foregroundColor: Colors.white,
              minimumSize: const Size.fromHeight(48),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(9),
              ),
            ),
            icon: const Icon(Icons.search),
            label: const Text(
              'Browse rooms',
              style: TextStyle(fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ),
    );
  }
}

final class _SavedRoomCard extends StatelessWidget {
  const _SavedRoomCard({
    required this.floor,
    required this.onNavigate,
    required this.onRemove,
    required this.room,
  });

  final CampusFloor floor;
  final VoidCallback onNavigate;
  final VoidCallback onRemove;
  final CampusRoom room;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: SavedPlacesScreenKeys.room(room.id),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [
          BoxShadow(color: CampusNavigatorColors.shadow, offset: Offset(4, 5)),
        ],
      ),
      child: Material(
        color: CampusNavigatorColors.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(
            color: CampusNavigatorColors.border,
            width: 1.8,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final compact = constraints.maxWidth < 340;
            return Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Container(
                    height: compact ? 52 : 60,
                    width: compact ? 52 : 60,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: _roomColor(room.visual),
                      border: Border.all(color: CampusNavigatorColors.border),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      _roomIcon(room.visual),
                      color: CampusNavigatorColors.text,
                      size: compact ? 25 : 29,
                    ),
                  ),
                  SizedBox(width: compact ? 9 : 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          room.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: CampusNavigatorColors.text,
                            fontSize: compact ? 16 : 18,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          'Floor ${floor.code.substring(1)} · ${room.roomCode}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: CampusNavigatorColors.textMuted,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          height: 38,
                          child: FilledButton.icon(
                            key: SavedPlacesScreenKeys.navigate(room.id),
                            onPressed: room.navigationAvailable
                                ? onNavigate
                                : null,
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
                            ),
                            icon: Icon(
                              room.navigationAvailable
                                  ? Icons.navigation_outlined
                                  : Icons.link_off,
                              size: 17,
                            ),
                            label: Text(
                              room.navigationAvailable
                                  ? 'Navigate'
                                  : 'Unavailable',
                              style: const TextStyle(
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    key: SavedPlacesScreenKeys.remove(room.id),
                    onPressed: onRemove,
                    tooltip: 'Remove ${room.name} from Saved',
                    icon: const Icon(
                      Icons.bookmark,
                      color: CampusNavigatorColors.accent,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

IconData _roomIcon(CampusRoomVisual visual) => switch (visual) {
  CampusRoomVisual.cafeteria => Icons.local_cafe_outlined,
  CampusRoomVisual.computerLab => Icons.computer,
  CampusRoomVisual.gym => Icons.fitness_center,
  CampusRoomVisual.library => Icons.menu_book_outlined,
  CampusRoomVisual.restroom => Icons.wc,
  CampusRoomVisual.generic ||
  CampusRoomVisual.lectureHall ||
  CampusRoomVisual.researchLab => Icons.meeting_room_outlined,
};

Color _roomColor(CampusRoomVisual visual) => switch (visual) {
  CampusRoomVisual.cafeteria => const Color(0xFFD8B8A8),
  CampusRoomVisual.computerLab => const Color(0xFFB8CCD9),
  CampusRoomVisual.gym => const Color(0xFFBFD2B8),
  CampusRoomVisual.library => const Color(0xFFC9BFA8),
  CampusRoomVisual.restroom => const Color(0xFFD3C7DE),
  CampusRoomVisual.generic ||
  CampusRoomVisual.lectureHall ||
  CampusRoomVisual.researchLab => const Color(0xFFD7C3A6),
};
