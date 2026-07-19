import 'package:flutter_test/flutter_test.dart';

import 'json_parity.dart';

void main() {
  const tolerance = ParityTolerance(absolute: 1e-6, relative: 1e-9);

  test('compares exact structure, ordered arrays, and tolerant doubles', () {
    final mismatches = compareParityJson(
      <String, Object?>{
        'count': 2,
        'values': <Object?>[1.0000001, 'ACCEPTED'],
      },
      <String, Object?>{
        'count': 2,
        'values': <Object?>[1.0, 'ACCEPTED'],
      },
      tolerance: tolerance,
    );

    expect(mismatches, isEmpty);
  });

  test('matches tagged non-finite numbers by classification', () {
    expect(
      compareParityJson(
        <Object?>[double.nan, double.infinity, double.negativeInfinity],
        <Object?>['NaN', 'Infinity', '-Infinity'],
        tolerance: tolerance,
      ),
      isEmpty,
    );
  });

  test('reports paths for exact mismatches', () {
    expect(
      compareParityJson(
        <String, Object?>{
          'items': <Object?>[1, 3],
        },
        <String, Object?>{
          'items': <Object?>[1, 2],
        },
        tolerance: tolerance,
      ),
      [r'$.items[1]: expected 2, got 3'],
    );
  });
}
