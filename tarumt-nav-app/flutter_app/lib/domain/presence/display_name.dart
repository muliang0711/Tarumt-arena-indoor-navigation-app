const maxPresenceDisplayNameLength = 24;

String normalizePresenceDisplayName(String value) =>
    value.trim().replaceAll(RegExp(r'\s+'), ' ');

String? validatePresenceDisplayName(String value) {
  final normalized = normalizePresenceDisplayName(value);
  if (normalized.isEmpty) {
    return 'Please enter a username.';
  }
  if (normalized.runes.length > maxPresenceDisplayNameLength) {
    return 'Use $maxPresenceDisplayNameLength characters or fewer.';
  }
  if (normalized.runes.any((rune) => rune < 0x20 || rune == 0x7f)) {
    return 'Username contains unsupported characters.';
  }
  return null;
}
