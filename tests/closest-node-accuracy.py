#!/usr/bin/env python3

import glob
import json
import math
import os
import re
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DIAGNOSTICS_DIRECTORY = REPOSITORY_ROOT / "knn-dianogstics"
NODE_REGISTRY_PATH = REPOSITORY_ROOT / "knn-api-server" / "resources" / "node-registry.json"


def load_node_coordinates() -> dict[str, tuple[float, float]]:
    with NODE_REGISTRY_PATH.open(encoding="utf-8") as registry_file:
        raw_nodes = json.load(registry_file)

    if not isinstance(raw_nodes, list) or not raw_nodes:
        raise ValueError("Node registry must be a non-empty JSON array")

    coordinates = {}
    for index, node in enumerate(raw_nodes):
        if not isinstance(node, dict):
            raise ValueError(f"Node registry entry {index} must be an object")

        missing_fields = {"nodeId", "x", "y"}.difference(node)
        if missing_fields:
            raise ValueError(
                f"Node registry entry {index} is missing: {', '.join(sorted(missing_fields))}"
            )

        node_id = node["nodeId"]
        if not isinstance(node_id, str) or not node_id:
            raise ValueError(f"Node registry entry {index} has an invalid nodeId")
        if node_id in coordinates:
            raise ValueError(f"Duplicate nodeId in node registry: {node_id}")

        x = node["x"]
        y = node["y"]
        if isinstance(x, bool) or not isinstance(x, (int, float)):
            raise ValueError(f"Node {node_id} has an invalid x coordinate")
        if isinstance(y, bool) or not isinstance(y, (int, float)):
            raise ValueError(f"Node {node_id} has an invalid y coordinate")
        if not math.isfinite(x) or not math.isfinite(y):
            raise ValueError(f"Node {node_id} coordinates must be finite")

        coordinates[node_id] = (float(x), float(y))

    return coordinates


def ground_truth_node(path: str) -> str:
    filename_suffix = os.path.basename(path).split("-", 1)[1][:-5]
    shortened_node_id = re.sub(r"-\d+$", "", filename_suffix)

    aliases = {
        "centernorthelev": "center-of-road-north-of-elevwest",
        "westofTA246door": "west-of-TA246door-opp-TA254",
    }
    return aliases.get(shortened_node_id, f"node-{shortened_node_id[4:]}")


def main() -> None:
    diagnostic_paths = sorted(glob.glob(str(DIAGNOSTICS_DIRECTORY / "*.json")))
    if not diagnostic_paths:
        raise ValueError(f"No diagnostic JSON files found in {DIAGNOSTICS_DIRECTORY}")

    node_coordinates = load_node_coordinates()
    results = []

    for path in diagnostic_paths:
        with open(path, encoding="utf-8") as diagnostic_file:
            diagnostic = json.load(diagnostic_file)

        estimate = (
            diagnostic["apiEstimate"]["x"],
            diagnostic["apiEstimate"]["y"],
        )
        ground_truth = ground_truth_node(path)
        if ground_truth not in node_coordinates:
            raise ValueError(
                f"Ground-truth node {ground_truth!r} from {os.path.basename(path)} "
                f"is missing from {NODE_REGISTRY_PATH}"
            )

        checked_node_ids = diagnostic.get("checkedNodeIds")
        if checked_node_ids is None:
            active_coordinates = node_coordinates
        else:
            if not isinstance(checked_node_ids, list) or not all(
                isinstance(node_id, str) for node_id in checked_node_ids
            ):
                raise ValueError(f"Invalid checkedNodeIds in {os.path.basename(path)}")
            active_coordinates = {
                node_id: coordinates
                for node_id, coordinates in node_coordinates.items()
                if node_id in set(checked_node_ids)
            }

        if ground_truth not in active_coordinates:
            raise ValueError(
                f"Ground-truth node {ground_truth!r} was not active in {os.path.basename(path)}"
            )
        if not active_coordinates:
            raise ValueError(f"No registry nodes were active in {os.path.basename(path)}")

        closest_node = min(
            active_coordinates,
            key=lambda node_id: math.dist(estimate, active_coordinates[node_id]),
        )
        results.append(
            (
                os.path.basename(path),
                ground_truth,
                closest_node,
                ground_truth == closest_node,
            )
        )

    correct_count = sum(is_correct for _, _, _, is_correct in results)
    total_count = len(results)
    percentage = (correct_count / total_count * 100.0) if total_count else 0.0

    print(f"Correct: {correct_count}/{total_count} ({percentage:.1f}%)")
    print("diagnostic\tground_truth\tclosest_node\tcorrect")
    for result in results:
        print("\t".join(map(str, result)))


if __name__ == "__main__":
    main()
