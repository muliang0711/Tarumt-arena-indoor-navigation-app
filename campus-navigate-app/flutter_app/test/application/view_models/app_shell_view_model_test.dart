import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/view_models/app_shell_view_model.dart';

void main() {
  test('starts on Home and emits only real section changes', () async {
    final viewModel = AppShellViewModel();
    final states = <AppShellViewState>[];
    final subscription = viewModel.states.listen(states.add);

    expect(viewModel.state.selectedSection, AppSection.home);
    expect(viewModel.state.navigatePage, AppNavigatePage.selectFloor);

    viewModel.selectSection(AppSection.home);
    viewModel.selectSection(AppSection.navigate);
    viewModel.selectSection(AppSection.saved);

    expect(states.map((state) => state.selectedSection), [
      AppSection.navigate,
      AppSection.saved,
    ]);
    expect(viewModel.state.selectedSection, AppSection.saved);

    await subscription.cancel();
    await viewModel.dispose();
  });

  test(
    'supports an injected initial section and rejects use after disposal',
    () async {
      final viewModel = AppShellViewModel(initialSection: AppSection.settings);

      expect(viewModel.state.selectedSection, AppSection.settings);
      await viewModel.dispose();

      expect(() => viewModel.selectSection(AppSection.home), throwsStateError);
    },
  );

  test(
    'switches between the Navigate root and the preserved map route',
    () async {
      final viewModel = AppShellViewModel();
      final states = <AppShellViewState>[];
      final subscription = viewModel.states.listen(states.add);

      viewModel.openFloorRooms();
      expect(viewModel.state.selectedSection, AppSection.navigate);
      expect(viewModel.state.navigatePage, AppNavigatePage.floorRooms);

      viewModel.openMap();
      expect(viewModel.state.selectedSection, AppSection.navigate);
      expect(viewModel.state.navigatePage, AppNavigatePage.map);

      viewModel.openMap();
      viewModel.openNavigateRoot();
      expect(viewModel.state.navigatePage, AppNavigatePage.selectFloor);
      expect(states, hasLength(3));

      await subscription.cancel();
      await viewModel.dispose();
    },
  );
}
