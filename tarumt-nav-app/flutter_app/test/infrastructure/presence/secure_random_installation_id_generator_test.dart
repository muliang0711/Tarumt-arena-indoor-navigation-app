import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/infrastructure/presence/identity/secure_random_installation_id_generator.dart';

void main() {
  test('creates a UUID v4-shaped anonymous installation identity', () {
    final generator = SecureRandomInstallationIdGenerator(random: Random(7));
    final first = generator.generate();
    final second = generator.generate();

    expect(
      first,
      matches(
        RegExp(
          r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
        ),
      ),
    );
    expect(second, isNot(first));
  });
}
