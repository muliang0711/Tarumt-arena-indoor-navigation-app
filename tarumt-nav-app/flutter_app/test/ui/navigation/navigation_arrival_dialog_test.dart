import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/campus/campus_floor.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';
import 'package:indoor_navigation/ui/navigation/navigation_arrival_dialog.dart';

void main() {
  testWidgets('shows destination details and requires explicit confirmation', (
    tester,
  ) async {
    var confirmations = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: NavigationArrivalDialog(
            floor: _floor,
            onConfirm: () => confirmations += 1,
            room: _room,
          ),
        ),
      ),
    );

    expect(find.text('Destination Reached'), findsOneWidget);
    expect(find.text('You have arrived at Computer Lab.'), findsOneWidget);
    expect(find.text('Third Floor · C301'), findsOneWidget);
    expect(
      tester.widget<ModalBarrier>(find.byType(ModalBarrier).first).dismissible,
      isFalse,
    );

    await tester.tapAt(const Offset(4, 4));
    await tester.pump();
    expect(confirmations, 0);

    await tester.tap(find.byKey(NavigationArrivalDialogKeys.confirm));
    await tester.pump();
    expect(confirmations, 1);
  });
}

const _floor = CampusFloor(
  code: 'F3',
  id: 'floor-3',
  name: 'Third Floor',
  plan: CampusFloorPlan.third,
  summary: 'Academics',
  tags: ['Classrooms'],
);

const _room = CampusRoom(
  category: CampusRoomCategory.lab,
  floorId: 'floor-3',
  id: 'computer-lab-c301',
  name: 'Computer Lab',
  navigationNodeId: 'node-20',
  roomCode: 'C301',
  typeLabel: 'Lab',
  visual: CampusRoomVisual.computerLab,
  walkMinutes: 2,
);
