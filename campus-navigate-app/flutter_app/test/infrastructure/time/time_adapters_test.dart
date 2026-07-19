import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/infrastructure/time/dart_periodic_scheduler.dart';
import 'package:indoor_navigation/infrastructure/time/system_clock.dart';

void main() {
  test('SystemClock returns current epoch milliseconds', () {
    const clock = SystemClock();
    final beforeMs = DateTime.now().millisecondsSinceEpoch;
    final actualMs = clock.nowMs();
    final afterMs = DateTime.now().millisecondsSinceEpoch;

    expect(actualMs, inInclusiveRange(beforeMs, afterMs));
  });

  group('DartPeriodicScheduler', () {
    test(
      'creates Timer.periodic with the exact interval and invokes callback',
      () {
        late _FakeTimer timer;
        Duration? capturedDuration;
        var callbackCount = 0;
        final scheduler = DartPeriodicScheduler(
          timerFactory: (Duration duration, void Function(Timer) callback) {
            capturedDuration = duration;
            timer = _FakeTimer(callback);
            return timer;
          },
        );

        final handle = scheduler.schedulePeriodic(
          intervalMs: 125,
          callback: () => callbackCount += 1,
        );
        timer.fire();
        timer.fire();

        expect(capturedDuration, const Duration(milliseconds: 125));
        expect(callbackCount, 2);
        expect(handle.isCancelled, isFalse);
      },
    );

    test('rejects non-positive intervals before creating a timer', () {
      var factoryCallCount = 0;
      final scheduler = DartPeriodicScheduler(
        timerFactory: (Duration _, void Function(Timer) callback) {
          factoryCallCount += 1;
          return _FakeTimer(callback);
        },
      );

      expect(
        () => scheduler.schedulePeriodic(intervalMs: 0, callback: () {}),
        throwsArgumentError,
      );
      expect(
        () => scheduler.schedulePeriodic(intervalMs: -1, callback: () {}),
        throwsArgumentError,
      );
      expect(factoryCallCount, 0);
    });

    test('cancellation is idempotent and delegates once to Timer', () {
      late _FakeTimer timer;
      final scheduler = DartPeriodicScheduler(
        timerFactory: (Duration _, void Function(Timer) callback) {
          timer = _FakeTimer(callback);
          return timer;
        },
      );
      final handle = scheduler.schedulePeriodic(
        intervalMs: 10,
        callback: () {},
      );

      handle.cancel();
      handle.cancel();

      expect(handle.isCancelled, isTrue);
      expect(timer.cancelCallCount, 1);
      expect(timer.isActive, isFalse);
    });
  });
}

final class _FakeTimer implements Timer {
  _FakeTimer(this._callback);

  final void Function(Timer) _callback;
  int cancelCallCount = 0;
  bool _isActive = true;
  int _tick = 0;

  @override
  bool get isActive => _isActive;

  @override
  int get tick => _tick;

  @override
  void cancel() {
    cancelCallCount += 1;
    _isActive = false;
  }

  void fire() {
    if (!_isActive) {
      return;
    }
    _tick += 1;
    _callback(this);
  }
}
