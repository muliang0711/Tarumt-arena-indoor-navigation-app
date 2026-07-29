import 'package:indoor_navigation/domain/reroute/reroute_models.dart';

WifiPositionConfidence? getTopConfidenceNode(
  List<WifiPositionConfidence> confidenceList,
) {
  WifiPositionConfidence? topNode;
  for (final node in confidenceList) {
    if (topNode == null || node.confidence > topNode.confidence) {
      topNode = node;
    }
  }

  return topNode;
}
