enum WifiNodeMappingErrorCode {
  knownUnmappedServerNode,
  missingLocalNode,
  unknownServerNode,
}

final class WifiNodeMappingException implements Exception {
  const WifiNodeMappingException({
    required this.code,
    required this.message,
    required this.serverNodeId,
  });

  final WifiNodeMappingErrorCode code;
  final String message;
  final String serverNodeId;

  @override
  String toString() => 'WifiNodeMappingException($code): $message';
}

final class WifiNodeMappingRegistry {
  WifiNodeMappingRegistry({
    required String floorId,
    required Map<String, String> mappings,
    required Map<String, String> unmappedServerNodes,
  }) : floorId = _requiredIdentifier(floorId, 'floorId'),
       mappings = Map.unmodifiable(mappings),
       unmappedServerNodes = Map.unmodifiable(unmappedServerNodes) {
    if (mappings.isEmpty) {
      throw ArgumentError.value(mappings, 'mappings', 'must not be empty');
    }
    for (final entry in mappings.entries) {
      _requiredIdentifier(entry.key, 'serverNodeId');
      _requiredIdentifier(entry.value, 'localNodeId');
      if (unmappedServerNodes.containsKey(entry.key)) {
        throw ArgumentError.value(
          entry.key,
          'serverNodeId',
          'cannot be both mapped and unmapped',
        );
      }
    }
    for (final entry in unmappedServerNodes.entries) {
      _requiredIdentifier(entry.key, 'unmapped serverNodeId');
      if (entry.value.trim().isEmpty) {
        throw ArgumentError.value(entry.value, 'reason', 'must not be empty');
      }
    }
  }

  final String floorId;
  final Map<String, String> mappings;
  final Map<String, String> unmappedServerNodes;

  List<String> get checkedServerNodeIds {
    final ids = mappings.keys.toList(growable: false)..sort();
    return List.unmodifiable(ids);
  }

  String resolve(
    String serverNodeId, {
    required Set<String> availableLocalNodeIds,
  }) {
    final normalized = _requiredIdentifier(serverNodeId, 'serverNodeId');
    final localNodeId = mappings[normalized];
    if (localNodeId == null) {
      final reason = unmappedServerNodes[normalized];
      throw WifiNodeMappingException(
        code: reason == null
            ? WifiNodeMappingErrorCode.unknownServerNode
            : WifiNodeMappingErrorCode.knownUnmappedServerNode,
        message: reason == null
            ? 'Server node "$normalized" is absent from the mapping registry.'
            : 'Server node "$normalized" is intentionally unmapped: $reason',
        serverNodeId: normalized,
      );
    }
    if (!availableLocalNodeIds.contains(localNodeId)) {
      throw WifiNodeMappingException(
        code: WifiNodeMappingErrorCode.missingLocalNode,
        message: 'Mapped local node "$localNodeId" is absent from the map.',
        serverNodeId: normalized,
      );
    }
    return localNodeId;
  }
}

String _requiredIdentifier(String value, String name) {
  final normalized = value.trim();
  if (normalized.isEmpty) {
    throw ArgumentError.value(value, name, 'must not be empty');
  }
  return normalized;
}
