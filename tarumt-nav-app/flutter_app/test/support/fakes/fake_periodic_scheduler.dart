import 'package:indoor_navigation/application/ports/time/periodic_scheduler.dart';

import 'fake_clock.dart';

/// A periodic scheduler that runs only when test code advances time manually.
///
/// Every elapsed interval is delivered. Callbacks are ordered first by due
/// time, then by registration order when due times are equal. A callback may
/// cancel itself or another task, and that cancellation takes effect
/// immediately.
final class FakePeriodicScheduler implements PeriodicScheduler {
  FakePeriodicScheduler({FakeClock? clock}) : clock = clock ?? FakeClock();

  final FakeClock clock;
  final List<_FakePeriodicTask> _tasks = <_FakePeriodicTask>[];
  int _nextRegistrationOrder = 0;
  int _callbackInvocationCount = 0;

  int get scheduledTaskCount => _tasks.length;

  int get activeTaskCount =>
      _tasks.where((_FakePeriodicTask task) => !task.isCancelled).length;

  int get callbackInvocationCount => _callbackInvocationCount;

  List<int> get activeNextDueTimesMs => List<int>.unmodifiable(
    _tasks
        .where((_FakePeriodicTask task) => !task.isCancelled)
        .map((_FakePeriodicTask task) => task.nextDueMs),
  );

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

    final task = _FakePeriodicTask(
      callback: callback,
      intervalMs: intervalMs,
      nextDueMs: clock.nowMs() + intervalMs,
      registrationOrder: _nextRegistrationOrder,
    );
    _nextRegistrationOrder += 1;
    _tasks.add(task);
    return task;
  }

  void advanceByMs(int elapsedMs) {
    if (elapsedMs < 0) {
      throw ArgumentError.value(
        elapsedMs,
        'elapsedMs',
        'must not move time backwards',
      );
    }
    advanceToMs(clock.nowMs() + elapsedMs);
  }

  void advanceToMs(int targetMs) {
    if (targetMs < clock.nowMs()) {
      throw ArgumentError.value(
        targetMs,
        'targetMs',
        'must not move time backwards',
      );
    }

    while (true) {
      final nextTask = _nextTaskDueBy(targetMs);
      if (nextTask == null) {
        break;
      }

      if (nextTask.nextDueMs > clock.nowMs()) {
        clock.advanceToMs(nextTask.nextDueMs);
      }
      nextTask.nextDueMs += nextTask.intervalMs;
      _callbackInvocationCount += 1;
      nextTask.callback();
    }

    clock.advanceToMs(targetMs);
  }

  _FakePeriodicTask? _nextTaskDueBy(int targetMs) {
    _FakePeriodicTask? result;
    for (final task in _tasks) {
      if (task.isCancelled || task.nextDueMs > targetMs) {
        continue;
      }
      if (result == null ||
          task.nextDueMs < result.nextDueMs ||
          (task.nextDueMs == result.nextDueMs &&
              task.registrationOrder < result.registrationOrder)) {
        result = task;
      }
    }
    return result;
  }
}

final class _FakePeriodicTask implements PeriodicTaskHandle {
  _FakePeriodicTask({
    required this.callback,
    required this.intervalMs,
    required this.nextDueMs,
    required this.registrationOrder,
  });

  final PeriodicTaskCallback callback;
  final int intervalMs;
  final int registrationOrder;
  int nextDueMs;

  @override
  bool isCancelled = false;

  @override
  void cancel() {
    isCancelled = true;
  }
}
