abstract interface class UserProfileStore {
  Future<String?> readDisplayName();

  Future<void> writeDisplayName(String displayName);
}
