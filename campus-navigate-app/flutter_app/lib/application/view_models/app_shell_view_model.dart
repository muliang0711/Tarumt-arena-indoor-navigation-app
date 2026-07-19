import 'dart:async';

enum AppSection { home, navigate, saved, settings }

enum AppNavigatePage { selectFloor, floorRooms, map }

final class AppShellViewState {
  const AppShellViewState({
    required this.navigatePage,
    required this.selectedSection,
  });

  final AppNavigatePage navigatePage;
  final AppSection selectedSection;
}

final class AppShellViewModel {
  AppShellViewModel({
    AppNavigatePage initialNavigatePage = AppNavigatePage.selectFloor,
    AppSection initialSection = AppSection.home,
  }) : _state = AppShellViewState(
         navigatePage: initialNavigatePage,
         selectedSection: initialSection,
       );

  final StreamController<AppShellViewState> _states =
      StreamController<AppShellViewState>.broadcast(sync: true);

  AppShellViewState _state;
  bool _disposed = false;

  AppShellViewState get state => _state;
  Stream<AppShellViewState> get states => _states.stream;

  void selectSection(AppSection section) {
    _throwIfDisposed();
    if (_state.selectedSection == section) {
      return;
    }
    _emit(
      AppShellViewState(
        navigatePage: _state.navigatePage,
        selectedSection: section,
      ),
    );
  }

  void openNavigateRoot() {
    _throwIfDisposed();
    if (_state.selectedSection == AppSection.navigate &&
        _state.navigatePage == AppNavigatePage.selectFloor) {
      return;
    }
    _emit(
      const AppShellViewState(
        navigatePage: AppNavigatePage.selectFloor,
        selectedSection: AppSection.navigate,
      ),
    );
  }

  void openMap() {
    _throwIfDisposed();
    if (_state.selectedSection == AppSection.navigate &&
        _state.navigatePage == AppNavigatePage.map) {
      return;
    }
    _emit(
      const AppShellViewState(
        navigatePage: AppNavigatePage.map,
        selectedSection: AppSection.navigate,
      ),
    );
  }

  void openFloorRooms() {
    _throwIfDisposed();
    if (_state.selectedSection == AppSection.navigate &&
        _state.navigatePage == AppNavigatePage.floorRooms) {
      return;
    }
    _emit(
      const AppShellViewState(
        navigatePage: AppNavigatePage.floorRooms,
        selectedSection: AppSection.navigate,
      ),
    );
  }

  Future<void> dispose() async {
    if (_disposed) {
      return;
    }
    _disposed = true;
    await _states.close();
  }

  void _throwIfDisposed() {
    if (_disposed) {
      throw StateError('AppShellViewModel is disposed.');
    }
  }

  void _emit(AppShellViewState state) {
    _state = state;
    _states.add(state);
  }
}
