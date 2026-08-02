import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/presence/display_name.dart';

void main() {
  test('normalizes whitespace and validates display names', () {
    expect(normalizePresenceDisplayName('  IShowSpeed  '), 'IShowSpeed');
    expect(normalizePresenceDisplayName('Mei   Ling'), 'Mei Ling');
    expect(validatePresenceDisplayName('   '), isNotNull);
    expect(validatePresenceDisplayName('IShowSpeed'), isNull);
    expect(validatePresenceDisplayName(List.filled(25, 'x').join()), isNotNull);
  });
}
