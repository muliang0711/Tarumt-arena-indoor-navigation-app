import 'package:indoor_navigation/application/ports/time/clock.dart';

final class SystemClock implements Clock {
  const SystemClock();

  @override
  int nowMs() => DateTime.now().millisecondsSinceEpoch;
}
