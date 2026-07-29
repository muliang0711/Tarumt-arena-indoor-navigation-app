abstract interface class InstallationIdentityStore {
  Future<String?> read();

  Future<void> write(String installationId);
}
