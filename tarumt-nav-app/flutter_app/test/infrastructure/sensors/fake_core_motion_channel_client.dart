import 'dart:async';
import 'dart:collection';

import 'package:indoor_navigation/infrastructure/sensors/core_motion_channel_client.dart';

final class CoreMotionMethodInvocation {
  CoreMotionMethodInvocation({
    required Map<String, Object?>? arguments,
    required this.method,
  }) : arguments = arguments == null ? null : Map.unmodifiable(arguments);

  final Map<String, Object?>? arguments;
  final String method;
}

final class FakeCoreMotionChannelClient implements CoreMotionChannelClient {
  final StreamController<Object?> _eventController =
      StreamController<Object?>.broadcast(sync: true);
  final List<CoreMotionMethodInvocation> _invocations = [];
  final Map<String, Queue<_MethodOutcome>> _scripts = {};

  @override
  Stream<Object?> get events => _eventController.stream;

  List<CoreMotionMethodInvocation> get invocations =>
      List<CoreMotionMethodInvocation>.unmodifiable(_invocations);

  void enqueueResult(String method, Object? result) {
    (_scripts[method] ??= Queue<_MethodOutcome>()).add(_MethodSuccess(result));
  }

  void enqueueFailure(String method, Object error) {
    (_scripts[method] ??= Queue<_MethodOutcome>()).add(_MethodFailure(error));
  }

  void emit(Object? event) {
    _eventController.add(event);
  }

  void emitError(Object error, [StackTrace? stackTrace]) {
    _eventController.addError(error, stackTrace);
  }

  Future<void> closeEvents() => _eventController.close();

  @override
  Future<Object?> invokeMethod(
    String method, {
    Map<String, Object?>? arguments,
  }) async {
    _invocations.add(
      CoreMotionMethodInvocation(arguments: arguments, method: method),
    );
    final script = _scripts[method];
    if (script == null || script.isEmpty) {
      return <String, Object?>{'schemaVersion': 1};
    }
    return switch (script.removeFirst()) {
      _MethodSuccess(:final value) => value,
      _MethodFailure(:final error) => throw error,
    };
  }
}

sealed class _MethodOutcome {
  const _MethodOutcome();
}

final class _MethodSuccess extends _MethodOutcome {
  const _MethodSuccess(this.value);

  final Object? value;
}

final class _MethodFailure extends _MethodOutcome {
  const _MethodFailure(this.error);

  final Object error;
}
