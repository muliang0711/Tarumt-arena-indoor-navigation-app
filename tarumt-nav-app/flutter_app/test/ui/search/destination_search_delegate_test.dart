import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/campus/campus_catalog.dart';
import 'package:indoor_navigation/ui/search/destination_search_delegate.dart';

void main() {
  test('searches destinations across room, type, and floor fields', () {
    expect(
      searchCampusDestinations(
        floors: mainCampusFloors,
        query: 'L305',
        rooms: mainCampusRooms,
      ).map((room) => room.id),
      contains('library-l305'),
    );
    expect(
      searchCampusDestinations(
        floors: mainCampusFloors,
        query: 'third lab',
        rooms: mainCampusRooms,
      ).map((room) => room.id),
      containsAll(<String>['computer-lab-c301', 'research-lab-r304']),
    );
    expect(
      searchCampusDestinations(
        floors: mainCampusFloors,
        query: 'fourth classroom',
        rooms: mainCampusRooms,
      ).map((room) => room.id),
      contains('seminar-room-s402'),
    );
  });
}
