import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Phase 7 application sources remain plain Dart and UI independent', () {
    final files = Directory('lib/application')
        .listSync(recursive: true)
        .whereType<File>()
        .where((file) => file.path.endsWith('.dart'));

    for (final file in files) {
      final source = file.readAsStringSync();
      expect(source, isNot(contains('package:flutter/')), reason: file.path);
      expect(source, isNot(contains('/infrastructure/')), reason: file.path);
      expect(source, isNot(contains('/ui/')), reason: file.path);
      expect(source, isNot(contains('dart:io')), reason: file.path);
      expect(source, isNot(contains('BuildContext')), reason: file.path);
      expect(source, isNot(contains('extends Widget')), reason: file.path);
    }
  });
}
