import 'package:indoor_navigation/application/ports/presence/installation_identity_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

const presenceInstallationIdKey = 'presence.installation_id.v1';

final class SharedPreferencesInstallationIdentityStore
    implements InstallationIdentityStore {
  SharedPreferencesInstallationIdentityStore({
    SharedPreferencesAsync? preferences,
  }) : _preferences = preferences ?? SharedPreferencesAsync();

  final SharedPreferencesAsync _preferences;

  @override
  Future<String?> read() => _preferences.getString(presenceInstallationIdKey);

  @override
  Future<void> write(String installationId) =>
      _preferences.setString(presenceInstallationIdKey, installationId);
}
