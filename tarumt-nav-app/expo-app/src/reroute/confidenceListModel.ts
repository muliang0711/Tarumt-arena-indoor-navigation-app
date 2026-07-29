import type { WifiPositionConfidence } from './type';

export function getTopConfidenceNode(
  confidenceList: readonly WifiPositionConfidence[],
) {
  return confidenceList.reduce<WifiPositionConfidence | null>(
    (topNode, node) => {
      if (!topNode || node.confidence > topNode.confidence) {
        return node;
      }

      return topNode;
    },
    null,
  );
}
