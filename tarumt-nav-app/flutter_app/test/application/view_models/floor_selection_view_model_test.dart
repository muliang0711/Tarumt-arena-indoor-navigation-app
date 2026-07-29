import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/view_models/floor_selection_view_model.dart';

void main() {
  test(
    'starts on suggested F3 and emits valid floor selection changes',
    () async {
      final viewModel = FloorSelectionViewModel();
      final states = <FloorSelectionViewState>[];
      final subscription = viewModel.states.listen(states.add);

      expect(viewModel.state.buildingName, 'Main Campus Building');
      expect(viewModel.state.floors, hasLength(4));
      expect(viewModel.state.selectedFloor.id, 'floor-3');
      expect(viewModel.state.selectedFloor.suggested, isTrue);

      viewModel.selectFloor('floor-3');
      viewModel.selectFloor('floor-1');

      expect(states, hasLength(1));
      expect(states.single.selectedFloor.id, 'floor-1');
      expect(() => viewModel.selectFloor('missing-floor'), throwsStateError);

      await subscription.cancel();
      await viewModel.dispose();
    },
  );

  test('rejects selection after disposal', () async {
    final viewModel = FloorSelectionViewModel();
    await viewModel.dispose();

    expect(() => viewModel.selectFloor('floor-1'), throwsStateError);
  });
}
