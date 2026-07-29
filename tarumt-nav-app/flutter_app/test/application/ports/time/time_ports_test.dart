import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/time/periodic_scheduler.dart';

import '../../../support/fakes/fake_clock.dart';
import '../../../support/fakes/fake_periodic_scheduler.dart';

void main() {
  group('FakeClock', () {
    test('starts at the requested time and advances deterministically', () {
      final clock = FakeClock(initialNowMs: 4000);

      expect(clock.nowMs(), 4000);

      clock.advanceByMs(25);
      expect(clock.nowMs(), 4025);

      clock.advanceToMs(5000);
      expect(clock.nowMs(), 5000);
    });

    test('allows a no-op advance but rejects backwards time', () {
      final clock = FakeClock(initialNowMs: 100);

      clock.advanceByMs(0);
      clock.advanceToMs(100);

      expect(() => clock.advanceByMs(-1), throwsArgumentError);
      expect(() => clock.advanceToMs(99), throwsArgumentError);
      expect(clock.nowMs(), 100);
    });
  });

  group('FakePeriodicScheduler', () {
    test('fires exactly at the due boundary, never just before it', () {
      final scheduler = FakePeriodicScheduler(
        clock: FakeClock(initialNowMs: 1000),
      );
      final callbackTimes = <int>[];
      scheduler.schedulePeriodic(
        intervalMs: 100,
        callback: () => callbackTimes.add(scheduler.clock.nowMs()),
      );

      scheduler.advanceByMs(99);
      expect(callbackTimes, isEmpty);
      expect(scheduler.clock.nowMs(), 1099);

      scheduler.advanceByMs(1);
      expect(callbackTimes, <int>[1100]);
    });

    test('repeats at every interval across separate advances', () {
      final scheduler = FakePeriodicScheduler();
      final callbackTimes = <int>[];
      scheduler.schedulePeriodic(
        intervalMs: 40,
        callback: () => callbackTimes.add(scheduler.clock.nowMs()),
      );

      scheduler.advanceByMs(40);
      scheduler.advanceByMs(39);
      scheduler.advanceByMs(1);
      scheduler.advanceByMs(40);

      expect(callbackTimes, <int>[40, 80, 120]);
    });

    test('large advance catches up every elapsed interval', () {
      final scheduler = FakePeriodicScheduler();
      final callbackTimes = <int>[];
      scheduler.schedulePeriodic(
        intervalMs: 25,
        callback: () => callbackTimes.add(scheduler.clock.nowMs()),
      );

      scheduler.advanceByMs(126);

      expect(callbackTimes, <int>[25, 50, 75, 100, 125]);
      expect(scheduler.clock.nowMs(), 126);
      expect(scheduler.callbackInvocationCount, 5);
      expect(scheduler.activeNextDueTimesMs, <int>[150]);
    });

    test('uses stable registration order when tasks share a due time', () {
      final scheduler = FakePeriodicScheduler();
      final calls = <String>[];
      scheduler.schedulePeriodic(
        intervalMs: 50,
        callback: () => calls.add('first'),
      );
      scheduler.schedulePeriodic(
        intervalMs: 50,
        callback: () => calls.add('second'),
      );
      scheduler.schedulePeriodic(
        intervalMs: 50,
        callback: () => calls.add('third'),
      );

      scheduler.advanceByMs(100);

      expect(calls, <String>[
        'first',
        'second',
        'third',
        'first',
        'second',
        'third',
      ]);
    });

    test('orders multiple tasks chronologically across a large advance', () {
      final scheduler = FakePeriodicScheduler();
      final calls = <String>[];
      scheduler.schedulePeriodic(
        intervalMs: 30,
        callback: () => calls.add('A@${scheduler.clock.nowMs()}'),
      );
      scheduler.schedulePeriodic(
        intervalMs: 50,
        callback: () => calls.add('B@${scheduler.clock.nowMs()}'),
      );

      scheduler.advanceByMs(150);

      expect(calls, <String>[
        'A@30',
        'B@50',
        'A@60',
        'A@90',
        'B@100',
        'A@120',
        'A@150',
        'B@150',
      ]);
    });

    test('cancellation before the due time prevents every callback', () {
      final scheduler = FakePeriodicScheduler();
      var callCount = 0;
      final handle = scheduler.schedulePeriodic(
        intervalMs: 10,
        callback: () => callCount += 1,
      );

      expect(handle.isCancelled, isFalse);
      handle.cancel();
      handle.cancel();
      scheduler.advanceByMs(100);

      expect(handle.isCancelled, isTrue);
      expect(callCount, 0);
      expect(scheduler.scheduledTaskCount, 1);
      expect(scheduler.activeTaskCount, 0);
    });

    test('a callback can cancel itself without another catch-up call', () {
      final scheduler = FakePeriodicScheduler();
      var callCount = 0;
      late PeriodicTaskHandle handle;
      handle = scheduler.schedulePeriodic(
        intervalMs: 10,
        callback: () {
          callCount += 1;
          handle.cancel();
        },
      );

      scheduler.advanceByMs(100);

      expect(callCount, 1);
      expect(handle.isCancelled, isTrue);
    });

    test('a callback can cancel a tied task before its callback', () {
      final scheduler = FakePeriodicScheduler();
      final calls = <String>[];
      late PeriodicTaskHandle secondHandle;
      scheduler.schedulePeriodic(
        intervalMs: 20,
        callback: () {
          calls.add('first');
          secondHandle.cancel();
        },
      );
      secondHandle = scheduler.schedulePeriodic(
        intervalMs: 20,
        callback: () => calls.add('second'),
      );

      scheduler.advanceByMs(20);

      expect(calls, <String>['first']);
    });

    test('task registered inside a callback starts at the current time', () {
      final scheduler = FakePeriodicScheduler();
      final calls = <String>[];
      late PeriodicTaskHandle firstHandle;
      firstHandle = scheduler.schedulePeriodic(
        intervalMs: 20,
        callback: () {
          calls.add('first@${scheduler.clock.nowMs()}');
          firstHandle.cancel();
          scheduler.schedulePeriodic(
            intervalMs: 5,
            callback: () => calls.add('nested@${scheduler.clock.nowMs()}'),
          );
        },
      );

      scheduler.advanceByMs(31);

      expect(calls, <String>['first@20', 'nested@25', 'nested@30']);
    });

    test('rejects zero or negative intervals and backwards advances', () {
      final scheduler = FakePeriodicScheduler(
        clock: FakeClock(initialNowMs: 10),
      );

      expect(
        () => scheduler.schedulePeriodic(intervalMs: 0, callback: () {}),
        throwsArgumentError,
      );
      expect(
        () => scheduler.schedulePeriodic(intervalMs: -1, callback: () {}),
        throwsArgumentError,
      );
      expect(() => scheduler.advanceByMs(-1), throwsArgumentError);
      expect(() => scheduler.advanceToMs(9), throwsArgumentError);
      expect(scheduler.clock.nowMs(), 10);
    });
  });
}
