import 'dart:convert';

import 'package:indoor_navigation/application/ports/journey/journey_outbox_store.dart';
import 'package:indoor_navigation/domain/journey/journey.dart';
import 'package:shared_preferences/shared_preferences.dart';

const journeyOutboxKey = 'journey.outbox.v1';

final class SharedPreferencesJourneyOutboxStore implements JourneyOutboxStore {
  SharedPreferencesJourneyOutboxStore({SharedPreferencesAsync? preferences})
    : _preferences = preferences ?? SharedPreferencesAsync();

  final SharedPreferencesAsync _preferences;

  @override
  Future<JourneyOutboxSnapshot> read() async {
    final source = await _preferences.getString(journeyOutboxKey);
    if (source == null || source.isEmpty) {
      return const JourneyOutboxSnapshot.empty();
    }
    final decoded = jsonDecode(source);
    if (decoded is! Map<String, dynamic>) {
      throw const FormatException('Journey outbox must be an object');
    }
    final pending = decoded['pending'];
    if (pending is! List<dynamic>) {
      throw const FormatException('Journey outbox pending must be an array');
    }
    final state = decoded['state'];
    return JourneyOutboxSnapshot(
      pending: pending
          .map((value) {
            if (value is! Map<String, dynamic>) {
              throw const FormatException(
                'Journey outbox command must be an object',
              );
            }
            return JourneyCommand.fromJson(value);
          })
          .toList(growable: false),
      state: state == null
          ? null
          : JourneyClientState.fromJson(state as Map<String, dynamic>),
    );
  }

  @override
  Future<void> write(JourneyOutboxSnapshot snapshot) {
    return _preferences.setString(
      journeyOutboxKey,
      jsonEncode(<String, Object?>{
        'pending': snapshot.pending
            .map((command) => command.toJson())
            .toList(growable: false),
        'state': snapshot.state?.toJson(),
      }),
    );
  }
}
