import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/presence/presence_reconnect_policy.dart';

void main() {
  test('backs off with bounded jitter and a fifteen-second ceiling', () {
    final policy = PresenceReconnectPolicy(random: Random(11));
    final delays = <int>[
      for (var attempt = 0; attempt < 12; attempt += 1)
        policy.delayForAttempt(attempt).inMilliseconds,
    ];

    expect(delays[0], inInclusiveRange(400, 600));
    expect(delays[1], inInclusiveRange(800, 1200));
    expect(delays[2], inInclusiveRange(1600, 2400));
    expect(delays.skip(5), everyElement(inInclusiveRange(12000, 15000)));
  });
}
