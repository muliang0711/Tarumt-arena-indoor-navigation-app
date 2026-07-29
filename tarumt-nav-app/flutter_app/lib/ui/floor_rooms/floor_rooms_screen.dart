import 'dart:async';

import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/view_models/floor_rooms_view_model.dart';
import 'package:indoor_navigation/domain/campus/campus_floor.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

abstract final class FloorRoomsScreenKeys {
  static const back = ValueKey<String>('floor-rooms.back');
  static const screen = ValueKey<String>('floor-rooms.screen');
  static const search = ValueKey<String>('floor-rooms.search');

  static ValueKey<String> filter(FloorRoomFilter filter) =>
      ValueKey<String>('floor-rooms.filter.${filter.name}');

  static ValueKey<String> navigate(String roomId) =>
      ValueKey<String>('floor-rooms.navigate.$roomId');

  static ValueKey<String> room(String roomId) =>
      ValueKey<String>('floor-rooms.room.$roomId');

  static ValueKey<String> save(String roomId) =>
      ValueKey<String>('floor-rooms.save.$roomId');
}

final class FloorRoomsScreen extends StatefulWidget {
  const FloorRoomsScreen({
    required this.onBack,
    required this.onNavigate,
    required this.viewModel,
    super.key,
  });

  final VoidCallback onBack;
  final ValueChanged<CampusRoom> onNavigate;
  final FloorRoomsViewModel viewModel;

  @override
  State<FloorRoomsScreen> createState() => _FloorRoomsScreenState();
}

final class _FloorRoomsScreenState extends State<FloorRoomsScreen> {
  late FloorRoomsViewState _state;
  late final StreamSubscription<FloorRoomsViewState> _subscription;
  late final TextEditingController _searchController;

  @override
  void initState() {
    super.initState();
    _state = widget.viewModel.state;
    _searchController = TextEditingController(text: _state.query);
    _subscription = widget.viewModel.states.listen((state) {
      if (!mounted) {
        return;
      }
      if (_searchController.text != state.query) {
        _searchController.value = TextEditingValue(
          text: state.query,
          selection: TextSelection.collapsed(offset: state.query.length),
        );
      }
      setState(() => _state = state);
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    unawaited(_subscription.cancel());
    super.dispose();
  }

  void _navigate(CampusRoom room) {
    widget.viewModel.selectRoom(room.id);
    widget.onNavigate(room);
  }

  @override
  Widget build(BuildContext context) {
    final floor = _state.selectedFloor;
    final rooms = _state.visibleRooms;
    return ColoredBox(
      color: CampusNavigatorColors.background,
      child: SafeArea(
        bottom: false,
        child: CustomScrollView(
          key: FloorRoomsScreenKeys.screen,
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(8, 14, 8, 28),
              sliver: SliverList.list(
                children: [
                  _Header(floor: floor, onBack: widget.onBack),
                  const SizedBox(height: 14),
                  _RoomSearch(
                    controller: _searchController,
                    onChanged: widget.viewModel.setSearchQuery,
                  ),
                  const SizedBox(height: 12),
                  _FilterBar(
                    onSelected: widget.viewModel.selectFilter,
                    selected: _state.filter,
                  ),
                  const SizedBox(height: 14),
                  const Divider(
                    color: CampusNavigatorColors.border,
                    height: 1,
                    thickness: 1.5,
                  ),
                  const SizedBox(height: 14),
                  _FloorOverview(floor: floor),
                  const SizedBox(height: 14),
                  if (rooms.isEmpty)
                    const _EmptyRooms()
                  else
                    for (var index = 0; index < rooms.length; index++) ...[
                      _RoomCard(
                        isSaved: _state.isRoomSaved(rooms[index].id),
                        onNavigate: () => _navigate(rooms[index]),
                        onToggleSaved: () =>
                            widget.viewModel.toggleSavedRoom(rooms[index].id),
                        room: rooms[index],
                      ),
                      if (index != rooms.length - 1) const SizedBox(height: 12),
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
  const _Header({required this.floor, required this.onBack});

  final CampusFloor floor;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          height: 54,
          width: 54,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            boxShadow: const [
              BoxShadow(
                color: CampusNavigatorColors.shadow,
                offset: Offset(3, 4),
              ),
            ],
          ),
          child: Material(
            color: CampusNavigatorColors.card,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
              side: const BorderSide(
                color: CampusNavigatorColors.border,
                width: 2,
              ),
            ),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              key: FloorRoomsScreenKeys.back,
              onTap: onBack,
              child: const Icon(
                Icons.chevron_left,
                color: CampusNavigatorColors.text,
                size: 31,
              ),
            ),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Floor ${floor.code.substring(1)}',
                style: const TextStyle(
                  color: CampusNavigatorColors.text,
                  fontFamily: 'monospace',
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.4,
                ),
              ),
              const SizedBox(height: 3),
              const Text(
                'Select a room or facility',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: CampusNavigatorColors.textMuted,
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

final class _RoomSearch extends StatelessWidget {
  const _RoomSearch({required this.controller, required this.onChanged});

  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 58,
      child: TextField(
        key: FloorRoomsScreenKeys.search,
        controller: controller,
        onChanged: onChanged,
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          filled: true,
          fillColor: CampusNavigatorColors.card,
          hintText: 'Search rooms on this floor',
          hintStyle: const TextStyle(
            color: CampusNavigatorColors.textMuted,
            fontSize: 17,
            fontWeight: FontWeight.w500,
          ),
          prefixIcon: const Icon(
            Icons.search,
            color: CampusNavigatorColors.textMuted,
            size: 28,
          ),
          suffixIcon: const Icon(
            Icons.location_on_outlined,
            color: CampusNavigatorColors.accent,
            size: 27,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(
              color: CampusNavigatorColors.border,
              width: 2,
            ),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(
              color: CampusNavigatorColors.border,
              width: 2,
            ),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(
              color: CampusNavigatorColors.accent,
              width: 2,
            ),
          ),
          contentPadding: const EdgeInsets.symmetric(vertical: 13),
        ),
      ),
    );
  }
}

final class _FilterBar extends StatelessWidget {
  const _FilterBar({required this.onSelected, required this.selected});

  final ValueChanged<FloorRoomFilter> onSelected;
  final FloorRoomFilter selected;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (
            var index = 0;
            index < FloorRoomFilter.values.length;
            index++
          ) ...[
            _FilterChip(
              filter: FloorRoomFilter.values[index],
              onPressed: () => onSelected(FloorRoomFilter.values[index]),
              selected: selected == FloorRoomFilter.values[index],
            ),
            if (index != FloorRoomFilter.values.length - 1)
              const SizedBox(width: 9),
          ],
        ],
      ),
    );
  }
}

final class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.filter,
    required this.onPressed,
    required this.selected,
  });

  final FloorRoomFilter filter;
  final VoidCallback onPressed;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Material(
      key: FloorRoomsScreenKeys.filter(filter),
      color: selected
          ? CampusNavigatorColors.accent
          : CampusNavigatorColors.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(7),
        side: BorderSide(
          color: selected
              ? CampusNavigatorColors.accent
              : CampusNavigatorColors.border,
          width: 1.8,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onPressed,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Text(
            filter.label,
            style: TextStyle(
              color: selected ? Colors.white : CampusNavigatorColors.textMuted,
              fontSize: 14,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ),
    );
  }
}

final class _FloorOverview extends StatelessWidget {
  const _FloorOverview({required this.floor});

  final CampusFloor floor;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: CampusNavigatorColors.card,
        border: Border.all(color: CampusNavigatorColors.border, width: 1.8),
        borderRadius: BorderRadius.circular(11),
      ),
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          SizedBox(
            height: 76,
            width: 105,
            child: CustomPaint(painter: _FloorOverviewPainter(floor.plan)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Floor ${floor.code.substring(1)} Overview',
                  style: const TextStyle(
                    color: CampusNavigatorColors.text,
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Tap a room to highlight it',
                  style: TextStyle(
                    color: CampusNavigatorColors.textMuted,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 7),
                const Wrap(
                  runSpacing: 5,
                  spacing: 10,
                  children: [
                    _Legend(color: Color(0xFFB8CCD9), label: 'Lab'),
                    _Legend(color: Color(0xFFC9BFA8), label: 'Library'),
                    _Legend(color: Color(0xFFD7C3A6), label: 'Class'),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

final class _Legend extends StatelessWidget {
  const _Legend({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
          child: const SizedBox.square(dimension: 13),
        ),
        const SizedBox(width: 5),
        Text(
          label,
          style: const TextStyle(
            color: CampusNavigatorColors.textMuted,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

final class _RoomCard extends StatelessWidget {
  const _RoomCard({
    required this.isSaved,
    required this.onNavigate,
    required this.onToggleSaved,
    required this.room,
  });

  final bool isSaved;
  final VoidCallback onNavigate;
  final VoidCallback onToggleSaved;
  final CampusRoom room;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: FloorRoomsScreenKeys.room(room.id),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(11),
        boxShadow: const [
          BoxShadow(color: CampusNavigatorColors.shadow, offset: Offset(4, 5)),
        ],
      ),
      child: Material(
        color: CampusNavigatorColors.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(11),
          side: const BorderSide(
            color: CampusNavigatorColors.border,
            width: 1.8,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 142),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final compact = constraints.maxWidth < 340;
              return Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 11,
                  vertical: 12,
                ),
                child: Row(
                  children: [
                    SizedBox.square(
                      dimension: compact ? 56 : 66,
                      child: CustomPaint(
                        painter: _RoomThumbnailPainter(room.visual),
                      ),
                    ),
                    SizedBox(width: compact ? 8 : 12),
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            room.name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: CampusNavigatorColors.text,
                              fontSize: compact ? 16 : 18,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 7),
                          Wrap(
                            runSpacing: 5,
                            spacing: 5,
                            children: [
                              _RoomTag(label: 'Rm ${room.roomCode}'),
                              _RoomTag(label: room.typeLabel),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              const Icon(
                                Icons.access_time,
                                color: CampusNavigatorColors.textMuted,
                                size: 17,
                              ),
                              const SizedBox(width: 5),
                              Flexible(
                                child: Text(
                                  '${room.walkMinutes} min walk',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: CampusNavigatorColors.textMuted,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          if (!room.navigationAvailable) ...[
                            const SizedBox(height: 6),
                            Text(
                              room.navigationIssue ?? 'Route unavailable',
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: CampusNavigatorColors.accent,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    SizedBox(width: compact ? 6 : 10),
                    SizedBox(
                      width: compact ? 88 : 104,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            key: FloorRoomsScreenKeys.save(room.id),
                            onPressed: onToggleSaved,
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
                          const SizedBox(height: 3),
                          SizedBox(
                            height: 54,
                            width: double.infinity,
                            child: FilledButton(
                              key: FloorRoomsScreenKeys.navigate(room.id),
                              onPressed: room.navigationAvailable
                                  ? onNavigate
                                  : null,
                              style: FilledButton.styleFrom(
                                backgroundColor:
                                    CampusNavigatorColors.accentBright,
                                foregroundColor: Colors.white,
                                padding: EdgeInsets.symmetric(
                                  horizontal: compact ? 8 : 12,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(9),
                                ),
                                textStyle: TextStyle(
                                  fontSize: compact ? 13 : 15,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Flexible(
                                    child: Text(
                                      room.navigationAvailable
                                          ? 'Navigate'
                                          : 'Unavailable',
                                    ),
                                  ),
                                  const SizedBox(width: 5),
                                  Icon(
                                    room.navigationAvailable
                                        ? Icons.arrow_forward
                                        : Icons.link_off,
                                    size: 18,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

final class _RoomTag extends StatelessWidget {
  const _RoomTag({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFFAF7EF),
        border: Border.all(color: CampusNavigatorColors.border, width: 1.1),
        borderRadius: BorderRadius.circular(5),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        child: Text(
          label,
          style: const TextStyle(
            color: CampusNavigatorColors.textMuted,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

final class _EmptyRooms extends StatelessWidget {
  const _EmptyRooms();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 34),
      decoration: BoxDecoration(
        color: CampusNavigatorColors.card,
        border: Border.all(color: CampusNavigatorColors.border, width: 1.5),
        borderRadius: BorderRadius.circular(11),
      ),
      child: const Column(
        children: [
          Icon(
            Icons.search_off,
            color: CampusNavigatorColors.textMuted,
            size: 32,
          ),
          SizedBox(height: 8),
          Text(
            'No rooms match this search',
            style: TextStyle(
              color: CampusNavigatorColors.text,
              fontSize: 15,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

extension on FloorRoomFilter {
  String get label => switch (this) {
    FloorRoomFilter.all => 'All',
    FloorRoomFilter.classroom => 'Classroom',
    FloorRoomFilter.lab => 'Lab',
    FloorRoomFilter.facility => 'Facility',
    FloorRoomFilter.restroom => 'Restroom',
  };
}

final class _FloorOverviewPainter extends CustomPainter {
  const _FloorOverviewPainter(this.plan);

  final CampusFloorPlan plan;

  @override
  void paint(Canvas canvas, Size size) {
    final border = Paint()
      ..color = const Color(0xFF6D4D2F)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3;
    final outer = RRect.fromRectAndRadius(
      Offset.zero & size,
      const Radius.circular(7),
    );
    canvas.drawRRect(outer, Paint()..color = const Color(0xFFE7DECC));
    canvas.drawRRect(outer, border);
    final inset = Rect.fromLTWH(5, 5, size.width - 10, size.height - 10);
    final colors = switch (plan) {
      CampusFloorPlan.ground => const [
        Color(0xFFBFA98A),
        Color(0xFFA8BF8B),
        Color(0xFF87A9C3),
      ],
      CampusFloorPlan.second => const [
        Color(0xFFC07E9D),
        Color(0xFF89A7BF),
        Color(0xFFBFA789),
      ],
      CampusFloorPlan.third => const [
        Color(0xFF84ABC2),
        Color(0xFFB9A17C),
        Color(0xFFA7BE87),
      ],
      CampusFloorPlan.fourth => const [
        Color(0xFFC08AAD),
        Color(0xFF88A8BF),
        Color(0xFFA9C18C),
      ],
    };
    final topHeight = inset.height * 0.52;
    final leftWidth = inset.width * 0.48;
    canvas.drawRect(
      Rect.fromLTWH(inset.left, inset.top, leftWidth, topHeight),
      Paint()..color = colors[0],
    );
    canvas.drawRect(
      Rect.fromLTWH(
        inset.left + leftWidth + 3,
        inset.top,
        inset.width - leftWidth - 3,
        topHeight,
      ),
      Paint()..color = colors[1],
    );
    canvas.drawRect(
      Rect.fromLTWH(
        inset.left,
        inset.top + topHeight + 3,
        inset.width,
        inset.height - topHeight - 3,
      ),
      Paint()..color = colors[2],
    );
    canvas.drawRect(inset, border);
  }

  @override
  bool shouldRepaint(covariant _FloorOverviewPainter oldDelegate) {
    return oldDelegate.plan != plan;
  }
}

final class _RoomThumbnailPainter extends CustomPainter {
  const _RoomThumbnailPainter(this.visual);

  final CampusRoomVisual visual;

  @override
  void paint(Canvas canvas, Size size) {
    final background = Paint()
      ..color = switch (visual) {
        CampusRoomVisual.computerLab => const Color(0xFFB5C8D5),
        CampusRoomVisual.library => const Color(0xFFC9B99C),
        CampusRoomVisual.lectureHall => const Color(0xFFD3C0A6),
        CampusRoomVisual.researchLab => const Color(0xFFB8C9D1),
        CampusRoomVisual.gym => const Color(0xFFBFD4B7),
        CampusRoomVisual.cafeteria => const Color(0xFFD5B9AA),
        CampusRoomVisual.restroom => const Color(0xFFC5C8C2),
        CampusRoomVisual.generic => const Color(0xFFD4C8B1),
      };
    final block = Paint()
      ..color = switch (visual) {
        CampusRoomVisual.computerLab => const Color(0xFF435669),
        CampusRoomVisual.library => const Color(0xFF9F8054),
        CampusRoomVisual.lectureHall => const Color(0xFF76553B),
        CampusRoomVisual.researchLab => const Color(0xFF52768A),
        CampusRoomVisual.gym => const Color(0xFF628C67),
        CampusRoomVisual.cafeteria => const Color(0xFFB86D55),
        CampusRoomVisual.restroom => const Color(0xFF747A75),
        CampusRoomVisual.generic => const Color(0xFF8B7357),
      };
    final outer = RRect.fromRectAndRadius(
      Offset.zero & size,
      const Radius.circular(8),
    );
    canvas.drawRRect(outer, background);
    canvas.drawRRect(
      outer,
      Paint()
        ..color = const Color(0xFF6D4D2F)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5,
    );
    final gap = size.width * 0.1;
    final cell = (size.width - gap * 4) / 3;
    for (var row = 0; row < 2; row++) {
      for (var column = 0; column < 3; column++) {
        if ((row == 1 && column == 2) ||
            (visual == CampusRoomVisual.gym && column == 1)) {
          continue;
        }
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(
              gap + column * (cell + gap),
              gap + row * (cell + gap),
              cell,
              cell,
            ),
            const Radius.circular(1.5),
          ),
          block,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant _RoomThumbnailPainter oldDelegate) {
    return oldDelegate.visual != visual;
  }
}
