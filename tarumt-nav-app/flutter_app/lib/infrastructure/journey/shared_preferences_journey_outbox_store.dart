import 'dart:convert';

import 'package:indoor_navigation/application/ports/journey/journey_outbox_store.dart';
import 'package:indoor_navigation/domain/journey/journey.dart';
import 'package:shared_preferences/shared_preferences.dart';

const journeyOutboxKey = 'journey.outbox.v1';

final class SharedPreferencesJourneyOutboxStore implements JourneyOutboxStore {
  SharedPreferencesJourneyOutboxStore({
    required Uri backendBaseUrl,
    SharedPreferencesAsync? preferences,
  }) : _preferences = preferences ?? SharedPreferencesAsync(),
       storageKey = scopedJourneyOutboxKey(backendBaseUrl);

  final String storageKey;

  final SharedPreferencesAsync _preferences;

  @override
  Future<JourneyOutboxSnapshot> read() async {
    // The legacy unscoped key is deliberately retained but never migrated:
    // its records may belong to an entirely different backend installation.
    final source = await _preferences.getString(storageKey);
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
      rejected: (decoded['rejected'] as List<dynamic>? ?? const [])
          .map(
            (value) => JourneyCommand.fromJson(value as Map<String, dynamic>),
          )
          .toList(),
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
      storageKey,
      jsonEncode(<String, Object?>{
        'rejected': snapshot.rejected
            .map((command) => command.toJson())
            .toList(),
        'pending': snapshot.pending
            .map((command) => command.toJson())
            .toList(growable: false),
        'state': snapshot.state?.toJson(),
      }),
    );
  }
}

String scopedJourneyOutboxKey(Uri baseUrl) {
  if (!['http', 'https'].contains(baseUrl.scheme) ||
      baseUrl.host.isEmpty ||
      baseUrl.userInfo.isNotEmpty ||
      baseUrl.hasQuery ||
      baseUrl.hasFragment) {
    throw ArgumentError('Journey backend must be an HTTP(S) base URL');
  }
  final normalized = baseUrl.replace(
    path: baseUrl.path.replaceFirst(RegExp(r'/+$'), ''),
  );
  return 'journey.outbox.v2.${Uri.encodeComponent(normalized.toString())}';
}
