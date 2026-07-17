from __future__ import annotations

import json
import re
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[3]
SCHEMA_MIGRATION = (
    BACKEND_ROOT / "supabase" / "migrations" / "202607170001_create_positioning_schema.sql"
)
REGISTRY_MIGRATION = (
    BACKEND_ROOT / "supabase" / "migrations" / "202607170002_import_registry_v1.sql"
)
REGISTRY_JSON = BACKEND_ROOT / "knn-api-server" / "resources" / "node-registry.json"


class PositioningSchemaContractTests(unittest.TestCase):
    def test_schema_contains_only_public_node_registry_data(self) -> None:
        schema = SCHEMA_MIGRATION.read_text(encoding="utf-8")

        self.assertIn("create table public.nodes", schema)
        self.assertIn("coordinates jsonb not null", schema)
        self.assertNotIn("x double precision not null", schema)
        self.assertNotIn("y double precision not null", schema)
        self.assertNotIn("model_versions", schema)
        self.assertNotIn("model_supported_nodes", schema)
        self.assertNotIn("positioning_deployments", schema)
        self.assertNotIn("storage.buckets", schema)
        self.assertNotIn("get_active_nodes", schema)
        self.assertIn("grant select on table public.nodes to anon, authenticated;", schema)
        self.assertIn('create policy "Node registry is publicly readable"', schema)

    def test_initial_registry_duplicates_legacy_values_across_both_frames(self) -> None:
        nodes = json.loads(REGISTRY_JSON.read_text(encoding="utf-8"))

        self.assertTrue(nodes)
        self.assertTrue(all(node["coordinates"]["lh"] == node["coordinates"]["xy"] for node in nodes))

    def test_initial_registry_migration_contains_every_canonical_node(self) -> None:
        migration = REGISTRY_MIGRATION.read_text(encoding="utf-8")
        nodes = json.loads(REGISTRY_JSON.read_text(encoding="utf-8"))
        imported_ids = set(re.findall(r"^\s*\('([^']+)',", migration, re.MULTILINE))

        self.assertEqual(imported_ids, {node["nodeId"] for node in nodes})


if __name__ == "__main__":
    unittest.main()
