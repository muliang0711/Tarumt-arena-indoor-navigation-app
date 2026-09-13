import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/infrastructure/journey/shared_preferences_journey_outbox_store.dart';

void main() {
  test('backend queues are distinct and never reuse the legacy queue', () {
    final cloud = scopedJourneyOutboxKey(
      Uri.parse('https://tarumtcampusnav.duckdns.org'),
    );
    expect(cloud, isNot(journeyOutboxKey));
    expect(
      cloud,
      isNot(scopedJourneyOutboxKey(Uri.parse('http://localhost:8080'))),
    );
    expect(
      cloud,
      scopedJourneyOutboxKey(Uri.parse('https://tarumtcampusnav.duckdns.org/')),
    );
    expect(
      cloud,
      isNot(
        scopedJourneyOutboxKey(
          Uri.parse('https://tarumtcampusnav.duckdns.org/other'),
        ),
      ),
    );
  });

  test('credentials and query parameters are not allowed in storage keys', () {
    for (final url in [
      'https://user:secret@example.com',
      'https://example.com?token=secret',
    ]) {
      expect(() => scopedJourneyOutboxKey(Uri.parse(url)), throwsArgumentError);
    }
  });
}
