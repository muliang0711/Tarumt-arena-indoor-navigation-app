#!/usr/bin/env python3
"""Compare, upload, or download the Supabase node registry without a data migration."""

from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path
from typing import Any

import requests


# Editable defaults. Command-line flags take precedence.
BACKEND_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REGISTRY_JSON = (
    BACKEND_ROOT / "knn-api-server" / "resources" / "node-registry.json"
)
DEFAULT_TIMEOUT_SECONDS = 15.0
NODE_COLUMNS = (
    "node_id,building_id,floor_id,coordinates,node_type,name,enabled,"
    "positioning_enabled,metadata"
)
VALID_NODE_TYPES = {"ELEVATOR", "DESTINATION", "JUNCTION"}
NODE_FIELDS = {
    "nodeId",
    "buildingId",
    "floorId",
    "coordinates",
    "type",
    "name",
    "enabled",
    "positioningEnabled",
    "metadata",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Synchronize the node registry between Supabase and the local JSON authoring file. "
            "No database migration is generated."
        )
    )
    parser.add_argument(
        "command",
        choices=("diff", "upload", "download"),
        help="diff compares local JSON to Supabase; upload upserts it; download exports Supabase.",
    )
    parser.add_argument(
        "--registry-json",
        type=Path,
        default=DEFAULT_REGISTRY_JSON,
        help=f"Local registry path (default: {DEFAULT_REGISTRY_JSON})",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Required before upload changes the database or download overwrites the JSON file.",
    )
    parser.add_argument(
        "--delete-missing",
        action="store_true",
        help=(
            "With upload --apply, also delete database nodes absent from the local JSON. "
            "Without this flag, upload is an upsert and never deletes rows."
        ),
    )
    return parser.parse_args()


def required_environment(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def api_headers(key: str, *, write: bool = False) -> dict[str, str]:
    headers = {"apikey": key, "Accept": "application/json"}
    if key.startswith("eyJ"):
        headers["Authorization"] = f"Bearer {key}"
    if write:
        headers["Content-Type"] = "application/json"
    return headers


def fetch_rows(url: str, key: str) -> list[dict[str, Any]]:
    response = requests.get(
        f"{url.rstrip('/')}/rest/v1/nodes",
        headers=api_headers(key),
        params={"select": NODE_COLUMNS, "order": "node_id.asc"},
        timeout=DEFAULT_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    rows = response.json()
    if not isinstance(rows, list):
        raise RuntimeError("Supabase nodes response must be a JSON array")
    return rows


def nonempty_string(value: Any, field: str, index: int) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Node registry entry {index} field {field} must be a non-empty string")
    return value


def coordinate_pair(value: Any, frame: str, index: int) -> dict[str, float | int]:
    if not isinstance(value, dict) or set(value) != {"x", "y"}:
        raise ValueError(
            f"Node registry entry {index} coordinates.{frame} must contain only x and y"
        )

    pair: dict[str, float | int] = {}
    for axis in ("x", "y"):
        coordinate = value[axis]
        if (
            isinstance(coordinate, bool)
            or not isinstance(coordinate, (int, float))
            or not math.isfinite(coordinate)
        ):
            raise ValueError(
                f"Node registry entry {index} coordinates.{frame}.{axis} "
                "must be a finite number"
            )
        pair[axis] = coordinate
    return pair


def node_to_database_row(node: Any, index: int) -> dict[str, Any]:
    if not isinstance(node, dict):
        raise ValueError(f"Node registry entry {index} must be a JSON object")

    unknown_fields = sorted(set(node) - NODE_FIELDS)
    if unknown_fields:
        raise ValueError(
            f"Node registry entry {index} has unknown fields: {', '.join(unknown_fields)}"
        )

    node_id = nonempty_string(node.get("nodeId"), "nodeId", index)
    building_id = nonempty_string(node.get("buildingId", "default"), "buildingId", index)
    floor_id = nonempty_string(node.get("floorId"), "floorId", index)
    node_type = nonempty_string(node.get("type"), "type", index)
    if node_type not in VALID_NODE_TYPES:
        raise ValueError(
            f"Node registry entry {index} field type must be one of "
            f"{', '.join(sorted(VALID_NODE_TYPES))}"
        )

    coordinates = node.get("coordinates")
    if not isinstance(coordinates, dict) or set(coordinates) != {"lh", "xy"}:
        raise ValueError(
            f"Node registry entry {index} coordinates must contain only lh and xy"
        )

    name = node.get("name")
    if name is not None and not isinstance(name, str):
        raise ValueError(f"Node registry entry {index} field name must be a string or null")

    enabled = node.get("enabled", True)
    positioning_enabled = node.get("positioningEnabled", True)
    if not isinstance(enabled, bool):
        raise ValueError(f"Node registry entry {index} field enabled must be boolean")
    if not isinstance(positioning_enabled, bool):
        raise ValueError(
            f"Node registry entry {index} field positioningEnabled must be boolean"
        )

    metadata = node.get("metadata", {})
    if not isinstance(metadata, dict):
        raise ValueError(f"Node registry entry {index} field metadata must be an object")

    return {
        "node_id": node_id,
        "building_id": building_id,
        "floor_id": floor_id,
        "coordinates": {
            "lh": coordinate_pair(coordinates["lh"], "lh", index),
            "xy": coordinate_pair(coordinates["xy"], "xy", index),
        },
        "node_type": node_type,
        "name": name,
        "enabled": enabled,
        "positioning_enabled": positioning_enabled,
        "metadata": metadata,
    }


def local_rows(path: Path) -> list[dict[str, Any]]:
    with path.resolve().open(encoding="utf-8") as registry_file:
        document = json.load(registry_file)

    if not isinstance(document, list):
        raise ValueError(f"Node registry must be a JSON array: {path.resolve()}")
    if not document:
        raise ValueError(f"Node registry must contain at least one node: {path.resolve()}")

    rows = [node_to_database_row(node, index) for index, node in enumerate(document)]
    node_ids = [row["node_id"] for row in rows]
    duplicate_ids = sorted({node_id for node_id in node_ids if node_ids.count(node_id) > 1})
    if duplicate_ids:
        raise ValueError(f"Duplicate nodeId in node registry: {', '.join(duplicate_ids)}")
    return sorted(rows, key=lambda row: row["node_id"])


def row_map(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(row["node_id"]): row for row in rows}


def diff_rows(
    local: list[dict[str, Any]],
    remote: list[dict[str, Any]],
) -> tuple[list[str], list[str], list[str]]:
    local_by_id = row_map(local)
    remote_by_id = row_map(remote)
    added = sorted(set(local_by_id) - set(remote_by_id))
    removed = sorted(set(remote_by_id) - set(local_by_id))
    changed = sorted(
        node_id
        for node_id in set(local_by_id) & set(remote_by_id)
        if local_by_id[node_id] != remote_by_id[node_id]
    )
    return added, removed, changed


def print_diff(local: list[dict[str, Any]], remote: list[dict[str, Any]]) -> None:
    added, removed, changed = diff_rows(local, remote)
    print(f"Local nodes: {len(local)}")
    print(f"Database nodes: {len(remote)}")
    print(f"Add: {', '.join(added) if added else '-'}")
    print(f"Change: {', '.join(changed) if changed else '-'}")
    print(f"Database-only: {', '.join(removed) if removed else '-'}")


def upload_rows(
    url: str,
    secret_key: str,
    local: list[dict[str, Any]],
    remote: list[dict[str, Any]],
    delete_missing: bool,
) -> None:
    response = requests.post(
        f"{url.rstrip('/')}/rest/v1/nodes",
        headers={
            **api_headers(secret_key, write=True),
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        params={"on_conflict": "node_id"},
        json=local,
        timeout=DEFAULT_TIMEOUT_SECONDS,
    )
    response.raise_for_status()

    if delete_missing:
        local_ids = set(row_map(local))
        for node_id in sorted(set(row_map(remote)) - local_ids):
            delete_response = requests.delete(
                f"{url.rstrip('/')}/rest/v1/nodes",
                headers=api_headers(secret_key),
                params={"node_id": f"eq.{node_id}"},
                timeout=DEFAULT_TIMEOUT_SECONDS,
            )
            delete_response.raise_for_status()


def database_rows_to_json(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "nodeId": row["node_id"],
            "buildingId": row["building_id"],
            "floorId": row["floor_id"],
            "coordinates": row["coordinates"],
            "type": row["node_type"],
            "name": row.get("name"),
            "enabled": row["enabled"],
            "positioningEnabled": row["positioning_enabled"],
            "metadata": row.get("metadata") or {},
        }
        for row in sorted(rows, key=lambda item: item["node_id"])
    ]


def main() -> int:
    args = parse_args()
    url = required_environment("SUPABASE_URL")
    read_key = (
        os.environ.get("SUPABASE_PUBLISHABLE_KEY", "").strip()
        or os.environ.get("SUPABASE_ANON_KEY", "").strip()
    )
    secret_key = (
        os.environ.get("SUPABASE_SECRET_KEY", "").strip()
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    )

    if args.command == "download":
        key = read_key or secret_key
        if not key:
            raise RuntimeError(
                "SUPABASE_PUBLISHABLE_KEY or SUPABASE_SECRET_KEY is required for download"
            )
        remote = fetch_rows(url, key)
        document = json.dumps(database_rows_to_json(remote), indent=2, ensure_ascii=False) + "\n"
        if args.apply:
            args.registry_json.resolve().write_text(document, encoding="utf-8")
            print(f"Wrote {len(remote)} nodes to {args.registry_json.resolve()}")
        else:
            print(document, end="")
        return 0

    if not read_key and not secret_key:
        raise RuntimeError("A Supabase publishable or secret key is required")
    remote = fetch_rows(url, read_key or secret_key)
    local = local_rows(args.registry_json)
    print_diff(local, remote)

    if args.command == "diff":
        return 0
    if not args.apply:
        print("Dry run only. Repeat with upload --apply to change Supabase.")
        return 0
    if not secret_key:
        raise RuntimeError(
            "SUPABASE_SECRET_KEY is required for upload "
            "(SUPABASE_SERVICE_ROLE_KEY is accepted for legacy projects)"
        )
    upload_rows(url, secret_key, local, remote, args.delete_missing)
    print("Supabase node registry updated. Restart the API server to reload it.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
