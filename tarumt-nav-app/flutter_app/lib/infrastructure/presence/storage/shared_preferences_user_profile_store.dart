import 'package:indoor_navigation/application/ports/presence/user_profile_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

const presenceDisplayNameKey = 'presence.display_name.v1';

final class SharedPreferencesUserProfileStore implements UserProfileStore {
  SharedPreferencesUserProfileStore({SharedPreferencesAsync? preferences})
    : _preferences = preferences ?? SharedPreferencesAsync();

  final SharedPreferencesAsync _preferences;

  @override
  Future<String?> readDisplayName() async {
    final value = (await _preferences.getString(
      presenceDisplayNameKey,
    ))?.trim();
    return value == null || value.isEmpty ? null : value;
  }

  @override
  Future<void> writeDisplayName(String displayName) =>
      _preferences.setString(presenceDisplayNameKey, displayName.trim());
}
