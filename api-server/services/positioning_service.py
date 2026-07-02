from collections import defaultdict
import math
from models.fingerprint import *
from models.wifi_scan import *
from models.position import *
from models.node import Node

class PositioningService:
    def __init__(self, fingerprints: List[FingerprintEntry], node_registry: Dict[str, Node]):
        self.fingerprints = fingerprints
        self.node_registry = node_registry
        self.k = 3
        self.penalty_rssi = -100.0

    def calculate_position(self, snapshot: WifiScanSnapshot) -> PositioningResponse:
        # 1. Thresholding: Ignore APs with RSSI weaker than -90dBm to reduce noise
        live_map = {r.bssid: r.rssi for r in snapshot.readings if r.rssi >= -90}

        # 2. Calculate Euclidean distances to all fingerprints in the database
        all_fingerprint_distances = []
        for fingerprint in self.fingerprints:
            fingerprint_map = {ap.bssid: ap.rssi for ap in fingerprint.apList}
            dist = self._calculate_euclidean_distance(live_map, fingerprint_map)
            all_fingerprint_distances.append((fingerprint.locationId, dist))

        # Update node distances: For each node, take the distance to its closest fingerprint
        node_distances: Dict[str, float] = {}
        for loc_id, dist in all_fingerprint_distances:
            if loc_id not in node_distances or dist < node_distances[loc_id]:
                node_distances[loc_id] = dist

        nearest_neighbors = sorted(all_fingerprint_distances, key=lambda x: x[1])[:self.k]

        # 3. Compute the weighted average of coordinates
        estimate = self._calculate_weighted_average(nearest_neighbors, snapshot.timestamp)

        return PositioningResponse(estimate=estimate, nodeDistances=node_distances)

    def _calculate_euclidean_distance(self, live_scan: Dict[str, int], fingerprint: Dict[str, int]) -> float:
        all_bssids = set(live_scan.keys()).union(set(fingerprint.keys()))
        sum_squared_diff = 0.0

        for bssid in all_bssids:
            rssi1 = float(live_scan.get(bssid, self.penalty_rssi))
            rssi2 = float(fingerprint.get(bssid, self.penalty_rssi))
            sum_squared_diff += (rssi1 - rssi2) ** 2
            
        return math.sqrt(sum_squared_diff)

    def _calculate_weighted_average(self, neighbors: List[Tuple[str, float]], timestamp: int) -> PositionEstimate:
        if not neighbors:
            return PositionEstimate(x=0.0, y=0.0, floorId="unknown", confidence=0.0, timestamp=timestamp)

        total_weight = 0.0
        sum_x = 0.0
        sum_y = 0.0
        floor_weights = defaultdict(float)

        for loc_id, dist in neighbors:
            node = self.node_registry.get(loc_id)
            if not node:
                continue
            
            # Inverse distance weighting (w = 1/d). Add epsilon to prevent div by zero.
            weight = 1.0 / (dist + 0.1)
            
            sum_x += node.x * weight
            sum_y += node.y * weight
            total_weight += weight
            
            # Clustering: Prioritize the floor with the highest cumulative weight
            floor_weights[node.floorId] += weight

        if total_weight == 0.0:
            return PositionEstimate(x=0.0, y=0.0, floorId="unknown", confidence=0.0, timestamp=timestamp)

        best_floor = max(floor_weights.items(), key=lambda item: item[1])[0] if floor_weights else "unknown"
        best_dist = neighbors[0][1]
        
        # Confidence heuristic: closer proximity to fingerprints means higher confidence
        # bounded between 0.0 and 1.0
        confidence = max(0.0, min(1.0, 1.0 / (best_dist / 10.0 + 1.0)))

        return PositionEstimate(
            x=sum_x / total_weight,
            y=sum_y / total_weight,
            floorId=best_floor,
            confidence=confidence,
            timestamp=timestamp,
            diagnostics={
                "algorithm": "WKNN-Remote",
                "k": str(len(neighbors)),
                "nearest_dist": f"{best_dist:.2f}"
            }
        )