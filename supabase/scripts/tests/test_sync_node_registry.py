import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).parents[1] / "sync_node_registry.py"
SPEC = importlib.util.spec_from_file_location("sync_node_registry", SCRIPT_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


def row(node_id, x=1.0):
    return {
        "node_id": node_id,
        "building_id": "default",
        "floor_id": "floor-2",
        "coordinates": {"lh": {"x": x, "y": 2.0}, "xy": {"x": x, "y": 2.0}},
        "node_type": "JUNCTION",
        "name": None,
        "enabled": True,
        "positioning_enabled": True,
        "metadata": {},
    }


class SyncNodeRegistryTests(unittest.TestCase):
    def test_diff_rows_reports_added_removed_and_changed_nodes(self):
        local = [row("added"), row("changed", x=9.0), row("same")]
        remote = [row("removed"), row("changed", x=1.0), row("same")]

        self.assertEqual(
            MODULE.diff_rows(local, remote),
            (["added"], ["removed"], ["changed"]),
        )

    def test_database_rows_to_json_uses_public_node_contract(self):
        document = MODULE.database_rows_to_json([row("node-a")])

        self.assertEqual(document[0]["nodeId"], "node-a")
        self.assertEqual(document[0]["coordinates"]["xy"]["x"], 1.0)
        self.assertTrue(document[0]["positioningEnabled"])

    def test_default_registry_path_targets_api_training_export(self):
        self.assertEqual(
            MODULE.DEFAULT_REGISTRY_JSON,
            Path(__file__).resolve().parents[3]
            / "knn-api-server"
            / "resources"
            / "node-registry.json",
        )

    def test_local_rows_validates_and_maps_without_api_server_imports(self):
        node = {
            "nodeId": "node-a",
            "floorId": "floor-2",
            "coordinates": {
                "lh": {"x": 1.0, "y": 2.0},
                "xy": {"x": 3.0, "y": 4.0},
            },
            "type": "JUNCTION",
            "name": "A",
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "registry.json"
            path.write_text(json.dumps([node]), encoding="utf-8")
            rows = MODULE.local_rows(path)

        self.assertEqual(rows, [
            {
                "node_id": "node-a",
                "building_id": "default",
                "floor_id": "floor-2",
                "coordinates": {
                    "lh": {"x": 1.0, "y": 2.0},
                    "xy": {"x": 3.0, "y": 4.0},
                },
                "node_type": "JUNCTION",
                "name": "A",
                "enabled": True,
                "positioning_enabled": True,
                "metadata": {},
            }
        ])


if __name__ == "__main__":
    unittest.main()
