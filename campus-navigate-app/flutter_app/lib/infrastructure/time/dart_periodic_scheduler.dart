import 'dart:async';

import 'package:indoor_navigation/application/ports/time/periodic_scheduler.dart';

typedef PeriodicTimerFactory =
    Timer Function(Duration duration, void Function(Timer timer) callback);

/// A real scheduler backed by [Timer.periodic].
///
/// It makes no catch-up guarantee when the event loop is delayed; callers get
/// the delivery behavior provided by Dart's timer runtime.
final class DartPeriodicScheduler implements PeriodicScheduler {
  DartPeriodicScheduler({PeriodicTimerFactory? timerFactory})
    : _timerFactory = timerFactory ?? Timer.periodic;

  final PeriodicTimerFactory _timerFactory;

  @override
  PeriodicTaskHandle schedulePeriodic({
    required int intervalMs,
    required PeriodicTaskCallback callback,
  }) {
    if (intervalMs <= 0) {
      throw ArgumentError.value(
        intervalMs,
        'intervalMs',
        'must be greater than zero',
      );
    }

    final timer = _timerFactory(
      Duration(milliseconds: intervalMs),
      (Timer _) => callback(),
    );
    return _DartPeriodicTaskHandle(timer);
  }
}

final class _DartPeriodicTaskHandle implements PeriodicTaskHandle {
  _DartPeriodicTaskHandle(this._timer);

  final Timer _timer;
  bool _isCancelled = false;

  @override
  bool get isCancelled => _isCancelled;

  @override
  void cancel() {
    if (_isCancelled) {
      return;
    }
    _isCancelled = true;
    _timer.cancel();
  }
}
