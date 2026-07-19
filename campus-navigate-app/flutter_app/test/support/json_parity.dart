import 'dart:math' as math;

final class ParityTolerance {
  const ParityTolerance({required this.absolute, required this.relative});

  final double absolute;
  final double relative;
}

List<String> compareParityJson(
  Object? actual,
  Object? expected, {
  required ParityTolerance tolerance,
}) {
  final mismatches = <String>[];
  _compareValue(
    actual,
    expected,
    path: r'$',
    tolerance: tolerance,
    mismatches: mismatches,
  );
  return mismatches;
}

void _compareValue(
  Object? actual,
  Object? expected, {
  required String path,
  required ParityTolerance tolerance,
  required List<String> mismatches,
}) {
  if (_isSpecialNumberTag(expected)) {
    if (!_matchesSpecialNumber(actual, expected! as String)) {
      mismatches.add('$path: expected $expected, got $actual');
    }
    return;
  }

  if (expected is num && actual is num) {
    if (expected is int && actual is int) {
      if (actual != expected) {
        mismatches.add('$path: expected $expected, got $actual');
      }
      return;
    }

    final expectedDouble = expected.toDouble();
    final actualDouble = actual.toDouble();
    final difference = (actualDouble - expectedDouble).abs();
    final scale = math.max(actualDouble.abs(), expectedDouble.abs());
    if (difference > tolerance.absolute &&
        difference > tolerance.relative * scale) {
      mismatches.add('$path: expected $expected, got $actual');
    }
    return;
  }

  if (expected is List<Object?> && actual is List<Object?>) {
    if (actual.length != expected.length) {
      mismatches.add(
        '$path: expected list length ${expected.length}, got ${actual.length}',
      );
      return;
    }
    for (var index = 0; index < expected.length; index += 1) {
      _compareValue(
        actual[index],
        expected[index],
        path: '$path[$index]',
        tolerance: tolerance,
        mismatches: mismatches,
      );
    }
    return;
  }

  if (expected is Map<String, Object?> && actual is Map<String, Object?>) {
    final expectedKeys = expected.keys.toSet();
    final actualKeys = actual.keys.toSet();
    if (!expectedKeys.containsAll(actualKeys) ||
        !actualKeys.containsAll(expectedKeys)) {
      mismatches.add('$path: expected keys $expectedKeys, got $actualKeys');
      return;
    }
    for (final key in expected.keys) {
      _compareValue(
        actual[key],
        expected[key],
        path: '$path.$key',
        tolerance: tolerance,
        mismatches: mismatches,
      );
    }
    return;
  }

  if (actual != expected) {
    mismatches.add('$path: expected $expected, got $actual');
  }
}

bool _isSpecialNumberTag(Object? value) {
  return value == 'NaN' || value == 'Infinity' || value == '-Infinity';
}

bool _matchesSpecialNumber(Object? actual, String expected) {
  if (actual == expected) {
    return true;
  }
  if (actual is! num) {
    return false;
  }
  final value = actual.toDouble();
  return switch (expected) {
    'NaN' => value.isNaN,
    'Infinity' => value == double.infinity,
    '-Infinity' => value == double.negativeInfinity,
    _ => false,
  };
}
