import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/view_models/home_view_model.dart';
import 'package:indoor_navigation/domain/campus/campus_floor.dart';
import 'package:indoor_navigation/domain/campus/campus_place.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

abstract final class HomeScreenKeys {
  static const mapPreview = ValueKey<String>('home.map-preview');
  static const collectionEmpty = ValueKey<String>('home.collection-empty');
  static const screen = ValueKey<String>('app-section.home');
  static const search = ValueKey<String>('home.search');

  static ValueKey<String> collectionPlace(String id) =>
      ValueKey<String>('home.collection-place.$id');

  static ValueKey<String> quickAccess(HomeQuickAccessTarget target) =>
      ValueKey<String>('home.quick-access.${target.name}');
}

final class HomeScreen extends StatelessWidget {
  const HomeScreen({
    required this.floors,
    required this.onOpenNavigate,
    required this.onSearchDestination,
    required this.onOpenSaved,
    required this.onOpenSettings,
    required this.onNavigateToRoom,
    required this.savedRooms,
    required this.viewModel,
    super.key,
  });

  final List<CampusFloor> floors;
  final VoidCallback onOpenNavigate;
  final VoidCallback onSearchDestination;
  final VoidCallback onOpenSaved;
  final VoidCallback onOpenSettings;
  final ValueChanged<CampusRoom> onNavigateToRoom;
  final List<CampusRoom> savedRooms;
  final HomeViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final state = viewModel.state;
    final collectionRooms = savedRooms.take(3).toList(growable: false);
    return ColoredBox(
      color: CampusNavigatorColors.background,
      child: SafeArea(
        bottom: false,
        child: CustomScrollView(
          key: HomeScreenKeys.screen,
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
              sliver: SliverList.list(
                children: [
                  const _HomeHeader(),
                  const SizedBox(height: 16),
                  _MapPreview(onPressed: onOpenNavigate),
                  const SizedBox(height: 16),
                  _DestinationSearch(onPressed: onSearchDestination),
                  const SizedBox(height: 18),
                  const _SectionTitle(title: 'Quick Access'),
                  const SizedBox(height: 10),
                  _QuickAccessGrid(
                    items: state.quickAccessItems,
                    onPressed: _handleQuickAccess,
                  ),
                  const SizedBox(height: 22),
                  _SectionTitle(
                    actionLabel: 'See all',
                    onActionPressed: onOpenSaved,
                    title: 'My Collection',
                  ),
                  const SizedBox(height: 10),
                  if (savedRooms.isEmpty)
                    _EmptyCollection(onBrowseRooms: onOpenNavigate)
                  else
                    for (
                      var index = 0;
                      index < collectionRooms.length;
                      index++
                    ) ...[
                      _CollectionPlaceCard(
                        floor: floors.firstWhere(
                          (floor) => floor.id == collectionRooms[index].floorId,
                        ),
                        onPressed: () =>
                            onNavigateToRoom(collectionRooms[index]),
                        room: collectionRooms[index],
                      ),
                      if (index != collectionRooms.length - 1)
                        const SizedBox(height: 12),
                    ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _handleQuickAccess(HomeQuickAccessTarget target) {
    switch (target) {
      case HomeQuickAccessTarget.selectFloor ||
          HomeQuickAccessTarget.selectRoom:
        onOpenNavigate();
      case HomeQuickAccessTarget.recentPlaces:
        onOpenSaved();
      case HomeQuickAccessTarget.settings:
        onOpenSettings();
    }
  }
}

final class _HomeHeader extends StatelessWidget {
  const _HomeHeader();

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Campus Navigator',
                style: TextStyle(
                  color: CampusNavigatorColors.text,
                  fontFamily: 'monospace',
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.5,
                ),
              ),
              SizedBox(height: 3),
              Text(
                'Find your way indoors',
                style: TextStyle(
                  color: CampusNavigatorColors.textMuted,
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Container(
          height: 52,
          width: 52,
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
            Icons.apartment_rounded,
            color: CampusNavigatorColors.card,
            size: 30,
          ),
        ),
      ],
    );
  }
}

final class _MapPreview extends StatelessWidget {
  const _MapPreview({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: HomeScreenKeys.mapPreview,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        boxShadow: const [
          BoxShadow(color: CampusNavigatorColors.shadow, offset: Offset(4, 5)),
        ],
      ),
      child: Material(
        color: CampusNavigatorColors.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: CampusNavigatorColors.border, width: 2),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onPressed,
          child: Column(
            children: [
              AspectRatio(
                aspectRatio: 1.9,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Image.asset(
                      'assets/maps/demo_1.png',
                      alignment: const Alignment(0, -0.1),
                      fit: BoxFit.cover,
                    ),
                    ColoredBox(color: Colors.white.withValues(alpha: 0.13)),
                    const CustomPaint(painter: _PreviewRoutePainter()),
                    const Positioned(
                      left: 28,
                      top: 72,
                      child: _MapLabel(label: 'LIBRARY'),
                    ),
                    const Positioned(
                      right: 72,
                      top: 72,
                      child: _MapLabel(label: 'COMP LAB'),
                    ),
                    const Align(
                      alignment: Alignment(0.1, 0.72),
                      child: _PreviewPositionMarker(),
                    ),
                  ],
                ),
              ),
              const DecoratedBox(
                decoration: BoxDecoration(
                  border: Border(
                    top: BorderSide(
                      color: CampusNavigatorColors.border,
                      width: 1.5,
                    ),
                  ),
                ),
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: 15, vertical: 13),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Navigate classrooms, facilities and common areas.',
                      style: TextStyle(
                        color: CampusNavigatorColors.textMuted,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

final class _DestinationSearch extends StatelessWidget {
  const _DestinationSearch({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      key: HomeScreenKeys.search,
      color: CampusNavigatorColors.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: CampusNavigatorColors.border, width: 2),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onPressed,
        child: const SizedBox(
          height: 56,
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 14),
            child: Row(
              children: [
                Icon(
                  Icons.search,
                  color: CampusNavigatorColors.textMuted,
                  size: 28,
                ),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Where do you want to go?',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: CampusNavigatorColors.textMuted,
                      fontSize: 17,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                SizedBox(width: 8),
                Icon(
                  Icons.location_on_outlined,
                  color: CampusNavigatorColors.accent,
                  size: 27,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

final class _SectionTitle extends StatelessWidget {
  const _SectionTitle({
    this.actionLabel,
    this.onActionPressed,
    required this.title,
  });

  final String? actionLabel;
  final VoidCallback? onActionPressed;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: const TextStyle(
              color: CampusNavigatorColors.text,
              fontSize: 19,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        if (actionLabel != null)
          TextButton(
            onPressed: onActionPressed,
            style: TextButton.styleFrom(
              foregroundColor: CampusNavigatorColors.accent,
              padding: const EdgeInsets.symmetric(horizontal: 4),
              textStyle: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
              ),
            ),
            child: Text(actionLabel!),
          ),
      ],
    );
  }
}

final class _QuickAccessGrid extends StatelessWidget {
  const _QuickAccessGrid({required this.items, required this.onPressed});

  final List<HomeQuickAccessItem> items;
  final ValueChanged<HomeQuickAccessTarget> onPressed;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 1.23,
        crossAxisSpacing: 14,
        mainAxisSpacing: 14,
      ),
      itemBuilder: (context, index) {
        final item = items[index];
        return _QuickAccessCard(
          item: item,
          onPressed: () => onPressed(item.target),
        );
      },
      itemCount: items.length,
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
    );
  }
}

final class _QuickAccessCard extends StatelessWidget {
  const _QuickAccessCard({required this.item, required this.onPressed});

  final HomeQuickAccessItem item;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: HomeScreenKeys.quickAccess(item.target),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [
          BoxShadow(color: CampusNavigatorColors.shadow, offset: Offset(4, 4)),
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
        child: InkWell(
          onTap: onPressed,
          child: Padding(
            padding: const EdgeInsets.all(13),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _QuickAccessIcon(target: item.target),
                const Spacer(),
                Text(
                  item.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: CampusNavigatorColors.text,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  item.subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: CampusNavigatorColors.textMuted,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

final class _QuickAccessIcon extends StatelessWidget {
  const _QuickAccessIcon({required this.target});

  final HomeQuickAccessTarget target;

  @override
  Widget build(BuildContext context) {
    final icon = switch (target) {
      HomeQuickAccessTarget.selectFloor => Icons.layers_outlined,
      HomeQuickAccessTarget.selectRoom => Icons.location_on_outlined,
      HomeQuickAccessTarget.recentPlaces => Icons.access_time,
      HomeQuickAccessTarget.settings => Icons.settings_outlined,
    };
    return Container(
      height: 40,
      width: 40,
      decoration: BoxDecoration(
        color: const Color(0xFFF9F6EE),
        border: Border.all(color: CampusNavigatorColors.border, width: 1.3),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(icon, color: CampusNavigatorColors.accent, size: 23),
    );
  }
}

final class _EmptyCollection extends StatelessWidget {
  const _EmptyCollection({required this.onBrowseRooms});

  final VoidCallback onBrowseRooms;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: HomeScreenKeys.collectionEmpty,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: CampusNavigatorColors.card,
        border: Border.all(color: CampusNavigatorColors.border, width: 1.8),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            height: 48,
            width: 48,
            decoration: BoxDecoration(
              color: const Color(0xFFF9F6EE),
              border: Border.all(
                color: CampusNavigatorColors.border,
                width: 1.3,
              ),
              borderRadius: BorderRadius.circular(9),
            ),
            child: const Icon(
              Icons.bookmark_add_outlined,
              color: CampusNavigatorColors.accent,
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'No collected places yet',
                  style: TextStyle(
                    color: CampusNavigatorColors.text,
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                SizedBox(height: 3),
                Text(
                  'Bookmark a room to keep it within easy reach.',
                  style: TextStyle(
                    color: CampusNavigatorColors.textMuted,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            onPressed: onBrowseRooms,
            tooltip: 'Browse rooms',
            icon: const Icon(Icons.arrow_forward),
            color: CampusNavigatorColors.accent,
          ),
        ],
      ),
    );
  }
}

final class _CollectionPlaceCard extends StatelessWidget {
  const _CollectionPlaceCard({
    required this.floor,
    required this.onPressed,
    required this.room,
  });

  final CampusFloor floor;
  final VoidCallback onPressed;
  final CampusRoom room;

  @override
  Widget build(BuildContext context) {
    final kind = _placeKindForRoom(room);
    return Container(
      key: HomeScreenKeys.collectionPlace(room.id),
      height: 108,
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
        child: InkWell(
          onTap: onPressed,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                SizedBox(
                  height: 78,
                  width: 78,
                  child: _PlaceThumbnail(kind: kind),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        room.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: CampusNavigatorColors.text,
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${floor.name} · ${room.roomCode}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: CampusNavigatorColors.textMuted,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                _PlaceKindIcon(kind: kind),
                const SizedBox(width: 4),
                const Icon(
                  Icons.chevron_right,
                  color: CampusNavigatorColors.border,
                  size: 24,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

CampusPlaceKind _placeKindForRoom(CampusRoom room) {
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

final class _PlaceKindIcon extends StatelessWidget {
  const _PlaceKindIcon({required this.kind});

  final CampusPlaceKind kind;

  @override
  Widget build(BuildContext context) {
    final (background, icon) = switch (kind) {
      CampusPlaceKind.library => (
        const Color(0xFFD4C9AC),
        Icons.menu_book_outlined,
      ),
      CampusPlaceKind.computerLab => (
        const Color(0xFFBDD0DB),
        Icons.desktop_windows_outlined,
      ),
      CampusPlaceKind.gym => (const Color(0xFFC4DAC2), Icons.fitness_center),
      CampusPlaceKind.cafeteria => (
        const Color(0xFFDABCAE),
        Icons.coffee_outlined,
      ),
      CampusPlaceKind.classroom => (
        const Color(0xFFD7C3A6),
        Icons.meeting_room_outlined,
      ),
      CampusPlaceKind.facility => (
        const Color(0xFFD8D2C4),
        Icons.apartment_outlined,
      ),
      CampusPlaceKind.restroom => (const Color(0xFFD3C7DE), Icons.wc),
    };
    return Container(
      height: 46,
      width: 46,
      decoration: BoxDecoration(
        color: background,
        border: Border.all(color: CampusNavigatorColors.border),
        borderRadius: BorderRadius.circular(9),
      ),
      child: Icon(icon, color: CampusNavigatorColors.text, size: 23),
    );
  }
}

final class _PlaceThumbnail extends StatelessWidget {
  const _PlaceThumbnail({required this.kind});

  final CampusPlaceKind kind;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(painter: _PlaceThumbnailPainter(kind));
  }
}

final class _PlaceThumbnailPainter extends CustomPainter {
  const _PlaceThumbnailPainter(this.kind);

  final CampusPlaceKind kind;

  @override
  void paint(Canvas canvas, Size size) {
    final border = Paint()
      ..color = const Color(0xFF6D4D2F)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3;
    final background = Paint()
      ..color = switch (kind) {
        CampusPlaceKind.library => const Color(0xFFC8B89A),
        CampusPlaceKind.computerLab => const Color(0xFFB5C7D4),
        CampusPlaceKind.gym => const Color(0xFFBFD4B7),
        CampusPlaceKind.cafeteria => const Color(0xFFD5B9AA),
        CampusPlaceKind.classroom => const Color(0xFFD7C3A6),
        CampusPlaceKind.facility => const Color(0xFFD8D2C4),
        CampusPlaceKind.restroom => const Color(0xFFD3C7DE),
      };
    final bounds = RRect.fromRectAndRadius(
      Offset.zero & size,
      const Radius.circular(8),
    );
    canvas.drawRRect(bounds, background);
    canvas.drawRRect(bounds, border);

    final block = Paint()
      ..color = switch (kind) {
        CampusPlaceKind.library => const Color(0xFF9E7F54),
        CampusPlaceKind.computerLab => const Color(0xFF435669),
        CampusPlaceKind.gym => const Color(0xFF628C67),
        CampusPlaceKind.cafeteria => const Color(0xFFB86D55),
        CampusPlaceKind.classroom => const Color(0xFF856442),
        CampusPlaceKind.facility => const Color(0xFF747A75),
        CampusPlaceKind.restroom => const Color(0xFF76658A),
      };
    final gap = size.width * 0.07;
    final cellWidth = (size.width - gap * 5) / 3;
    final cellHeight = (size.height - gap * 4) / 2;
    for (var row = 0; row < 2; row++) {
      for (var column = 0; column < 3; column++) {
        if ((kind == CampusPlaceKind.cafeteria && row == 1 && column > 0) ||
            (kind == CampusPlaceKind.gym && column == 1)) {
          continue;
        }
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(
              gap + column * (cellWidth + gap),
              gap + row * (cellHeight + gap),
              cellWidth,
              cellHeight,
            ),
            const Radius.circular(1.5),
          ),
          block,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant _PlaceThumbnailPainter oldDelegate) {
    return oldDelegate.kind != kind;
  }
}

final class _MapLabel extends StatelessWidget {
  const _MapLabel({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: CampusNavigatorColors.text.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(3),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Text(
          label,
          style: const TextStyle(
            color: Colors.white,
            fontFamily: 'monospace',
            fontSize: 8,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

final class _PreviewPositionMarker extends StatelessWidget {
  const _PreviewPositionMarker();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 32,
      width: 32,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.75),
        border: Border.all(color: const Color(0xFF4A8BD0), width: 4),
        shape: BoxShape.circle,
      ),
      child: const Center(
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: Color(0xFF3477BC),
            shape: BoxShape.circle,
          ),
          child: SizedBox.square(dimension: 9),
        ),
      ),
    );
  }
}

final class _PreviewRoutePainter extends CustomPainter {
  const _PreviewRoutePainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = CampusNavigatorColors.accentBright
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke;
    final points = [
      Offset(size.width * 0.55, size.height * 0.78),
      Offset(size.width * 0.55, size.height * 0.58),
      Offset(size.width * 0.66, size.height * 0.58),
      Offset(size.width * 0.66, size.height * 0.2),
    ];
    for (var index = 0; index < points.length - 1; index++) {
      _drawDashedLine(canvas, points[index], points[index + 1], paint);
    }
    canvas.drawRect(
      Rect.fromCenter(center: points.last, height: 14, width: 14),
      Paint()
        ..color = Colors.transparent
        ..style = PaintingStyle.fill,
    );
    canvas.drawRect(
      Rect.fromCenter(center: points.last, height: 14, width: 14),
      paint..style = PaintingStyle.stroke,
    );
  }

  void _drawDashedLine(Canvas canvas, Offset start, Offset end, Paint paint) {
    final delta = end - start;
    final distance = delta.distance;
    if (distance == 0) {
      return;
    }
    final direction = delta / distance;
    const dash = 6.0;
    const gap = 4.0;
    var travelled = 0.0;
    while (travelled < distance) {
      final dashEnd = (travelled + dash).clamp(0.0, distance).toDouble();
      canvas.drawLine(
        start + direction * travelled,
        start + direction * dashEnd,
        paint,
      );
      travelled += dash + gap;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
