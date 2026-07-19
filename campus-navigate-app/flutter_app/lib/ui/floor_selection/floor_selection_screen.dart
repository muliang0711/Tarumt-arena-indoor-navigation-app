import 'dart:async';

import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/view_models/floor_selection_view_model.dart';
import 'package:indoor_navigation/domain/campus/campus_floor.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

abstract final class FloorSelectionScreenKeys {
  static const back = ValueKey<String>('floor-selection.back');
  static const building = ValueKey<String>('floor-selection.building');
  static const screen = ValueKey<String>('floor-selection.screen');

  static ValueKey<String> floor(String id) =>
      ValueKey<String>('floor-selection.floor.$id');
}

final class FloorSelectionScreen extends StatefulWidget {
  const FloorSelectionScreen({
    required this.onBack,
    required this.viewModel,
    this.onFloorSelected,
    super.key,
  });

  final VoidCallback onBack;
  final ValueChanged<CampusFloor>? onFloorSelected;
  final FloorSelectionViewModel viewModel;

  @override
  State<FloorSelectionScreen> createState() => _FloorSelectionScreenState();
}

final class _FloorSelectionScreenState extends State<FloorSelectionScreen> {
  late FloorSelectionViewState _state;
  late final StreamSubscription<FloorSelectionViewState> _subscription;

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

  void _selectFloor(CampusFloor floor) {
    widget.viewModel.selectFloor(floor.id);
    widget.onFloorSelected?.call(floor);
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: CampusNavigatorColors.background,
      child: SafeArea(
        bottom: false,
        child: CustomScrollView(
          key: FloorSelectionScreenKeys.screen,
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(12, 16, 12, 28),
              sliver: SliverList.list(
                children: [
                  _Header(onBack: widget.onBack),
                  const SizedBox(height: 14),
                  _BuildingSelector(buildingName: _state.buildingName),
                  const SizedBox(height: 18),
                  const Divider(
                    color: CampusNavigatorColors.border,
                    height: 1,
                    thickness: 1.5,
                  ),
                  const SizedBox(height: 16),
                  for (
                    var index = 0;
                    index < _state.floors.length;
                    index++
                  ) ...[
                    _FloorCard(
                      floor: _state.floors[index],
                      onPressed: () => _selectFloor(_state.floors[index]),
                      selected:
                          _state.selectedFloorId == _state.floors[index].id,
                    ),
                    if (index != _state.floors.length - 1)
                      const SizedBox(height: 14),
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
  const _Header({required this.onBack});

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
              key: FloorSelectionScreenKeys.back,
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
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Select Floor',
                style: TextStyle(
                  color: CampusNavigatorColors.text,
                  fontFamily: 'monospace',
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.4,
                ),
              ),
              SizedBox(height: 3),
              Text(
                'Choose the floor you want to explore',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: CampusNavigatorColors.textMuted,
                  fontSize: 14,
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

final class _BuildingSelector extends StatelessWidget {
  const _BuildingSelector({required this.buildingName});

  final String buildingName;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: FloorSelectionScreenKeys.building,
      height: 58,
      decoration: BoxDecoration(
        color: CampusNavigatorColors.card,
        border: Border.all(color: CampusNavigatorColors.border, width: 2),
        borderRadius: BorderRadius.circular(11),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Row(
        children: [
          const Icon(
            Icons.apartment_outlined,
            color: CampusNavigatorColors.text,
            size: 26,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              buildingName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: CampusNavigatorColors.text,
                fontSize: 17,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const Icon(
            Icons.chevron_right,
            color: CampusNavigatorColors.textMuted,
            size: 25,
          ),
        ],
      ),
    );
  }
}

final class _FloorCard extends StatelessWidget {
  const _FloorCard({
    required this.floor,
    required this.onPressed,
    required this.selected,
  });

  final CampusFloor floor;
  final VoidCallback onPressed;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final borderColor = selected
        ? CampusNavigatorColors.accentBright
        : CampusNavigatorColors.border;
    return Container(
      key: FloorSelectionScreenKeys.floor(floor.id),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(13),
        boxShadow: [
          BoxShadow(
            color: selected
                ? const Color(0xFFD99559)
                : CampusNavigatorColors.shadow,
            offset: const Offset(4, 5),
          ),
        ],
      ),
      child: Material(
        color: CampusNavigatorColors.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(13),
          side: BorderSide(color: borderColor, width: selected ? 2.3 : 1.8),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onPressed,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 142),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 14, 10, 14),
              child: Row(
                children: [
                  SizedBox(
                    height: 78,
                    width: 88,
                    child: _FloorPlanThumbnail(plan: floor.plan),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          crossAxisAlignment: WrapCrossAlignment.center,
                          runSpacing: 5,
                          spacing: 9,
                          children: [
                            Text(
                              floor.code,
                              style: TextStyle(
                                color: selected
                                    ? CampusNavigatorColors.accentBright
                                    : CampusNavigatorColors.text,
                                fontFamily: 'monospace',
                                fontSize: 15,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            Text(
                              floor.name,
                              style: const TextStyle(
                                color: CampusNavigatorColors.text,
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            if (floor.suggested) const _SuggestedChip(),
                          ],
                        ),
                        const SizedBox(height: 7),
                        Text(
                          floor.summary,
                          style: const TextStyle(
                            color: CampusNavigatorColors.textMuted,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 9),
                        Wrap(
                          runSpacing: 6,
                          spacing: 6,
                          children: [
                            for (final tag in floor.tags) _FloorTag(label: tag),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Icon(
                    Icons.chevron_right,
                    color: CampusNavigatorColors.border,
                    size: 26,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

final class _SuggestedChip extends StatelessWidget {
  const _SuggestedChip();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: CampusNavigatorColors.accentBright),
        borderRadius: BorderRadius.circular(5),
      ),
      child: const Padding(
        padding: EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        child: Text(
          'Suggested',
          style: TextStyle(
            color: CampusNavigatorColors.accentBright,
            fontSize: 12,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

final class _FloorTag extends StatelessWidget {
  const _FloorTag({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFFAF7EF),
        border: Border.all(color: CampusNavigatorColors.border, width: 1.2),
        borderRadius: BorderRadius.circular(5),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
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

final class _FloorPlanThumbnail extends StatelessWidget {
  const _FloorPlanThumbnail({required this.plan});

  final CampusFloorPlan plan;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(painter: _FloorPlanPainter(plan));
  }
}

final class _FloorPlanPainter extends CustomPainter {
  const _FloorPlanPainter(this.plan);

  final CampusFloorPlan plan;

  @override
  void paint(Canvas canvas, Size size) {
    final outer = RRect.fromRectAndRadius(
      Offset.zero & size,
      const Radius.circular(8),
    );
    canvas.drawRRect(outer, Paint()..color = const Color(0xFFE8E0CF));
    canvas.drawRRect(
      outer,
      Paint()
        ..color = const Color(0xFF7A5737)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3,
    );

    final inset = Rect.fromLTWH(5, 5, size.width - 10, size.height - 10);
    final wall = Paint()
      ..color = const Color(0xFF69462C)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3;
    switch (plan) {
      case CampusFloorPlan.ground:
        _fill(canvas, Rect.fromLTWH(inset.left, inset.top, 37, 34), 0xFFBEA98B);
        _fill(
          canvas,
          Rect.fromLTWH(inset.left + 41, inset.top, inset.width - 41, 34),
          0xFFA9BF8C,
        );
        _fill(
          canvas,
          Rect.fromLTWH(
            inset.left,
            inset.top + 38,
            inset.width,
            inset.height - 38,
          ),
          0xFF86A9C3,
        );
      case CampusFloorPlan.second:
        _fill(
          canvas,
          Rect.fromLTWH(inset.left, inset.top, 32, inset.height),
          0xFFC17E9D,
        );
        _fill(
          canvas,
          Rect.fromLTWH(inset.left + 36, inset.top, inset.width - 36, 32),
          0xFF89A7BF,
        );
        _fill(
          canvas,
          Rect.fromLTWH(
            inset.left + 36,
            inset.top + 36,
            inset.width - 36,
            inset.height - 36,
          ),
          0xFFBFA789,
        );
      case CampusFloorPlan.third:
        _fill(canvas, Rect.fromLTWH(inset.left, inset.top, 39, 35), 0xFF85ABC2);
        _fill(
          canvas,
          Rect.fromLTWH(inset.left + 43, inset.top, inset.width - 43, 35),
          0xFFB9A17C,
        );
        _fill(
          canvas,
          Rect.fromLTWH(
            inset.left,
            inset.top + 39,
            inset.width,
            inset.height - 39,
          ),
          0xFFA7BE87,
        );
      case CampusFloorPlan.fourth:
        _fill(
          canvas,
          Rect.fromLTWH(inset.left, inset.top, inset.width, 34),
          0xFFC08AAD,
        );
        _fill(
          canvas,
          Rect.fromLTWH(inset.left, inset.top + 38, 39, inset.height - 38),
          0xFF88A8BF,
        );
        _fill(
          canvas,
          Rect.fromLTWH(
            inset.left + 43,
            inset.top + 38,
            inset.width - 43,
            inset.height - 38,
          ),
          0xFFA9C18C,
        );
    }
    canvas.drawRect(inset, wall);

    if (plan == CampusFloorPlan.third) {
      final stripe = Paint()..color = const Color(0xFF6D9DB7);
      for (var index = 0; index < 3; index++) {
        canvas.drawRect(
          Rect.fromLTWH(inset.left + 6 + index * 8, inset.top + 5, 5, 24),
          stripe,
        );
      }
    }
    if (plan == CampusFloorPlan.fourth) {
      final stripe = Paint()..color = const Color(0xFFA06F9A);
      for (var index = 0; index < 7; index++) {
        canvas.drawRect(
          Rect.fromLTWH(inset.left + 5 + index * 10, inset.top + 5, 6, 23),
          stripe,
        );
      }
    }
  }

  void _fill(Canvas canvas, Rect rect, int color) {
    canvas.drawRect(rect, Paint()..color = Color(color));
  }

  @override
  bool shouldRepaint(covariant _FloorPlanPainter oldDelegate) {
    return oldDelegate.plan != plan;
  }
}
