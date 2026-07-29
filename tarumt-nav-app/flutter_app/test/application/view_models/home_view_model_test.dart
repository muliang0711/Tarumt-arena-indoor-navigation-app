import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/view_models/home_view_model.dart';
import 'package:indoor_navigation/domain/campus/campus_place.dart';

void main() {
  test('exposes the immutable reference Home catalog', () {
    const viewModel = HomeViewModel();
    final state = viewModel.state;

    expect(state.recentVisitCount, 3);
    expect(
      state.quickAccessItems.map((item) => item.target),
      HomeQuickAccessTarget.values,
    );
    expect(state.popularPlaces.map((place) => place.name), [
      'Library',
      'Computer Lab',
      'Gym',
      'Cafeteria',
    ]);
    expect(state.popularPlaces.first.kind, CampusPlaceKind.library);
    expect(state.popularPlaces.first.locationLabel, 'Floor 3 · L305');
    expect(
      () => state.popularPlaces.add(state.popularPlaces.first),
      throwsUnsupportedError,
    );
  });
}
