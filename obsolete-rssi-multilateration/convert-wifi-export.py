"""Convert a WiFi Analyzer export into the scan format used by main.py."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DEFAULT_OUTPUT = ROOT / "saved-wifi-scans" / "wifi-scan.json"


def parse_strength(strength_value: str) -> int:
    """Convert an RSSI string such as '-72dBm' to -72."""
    return int(strength_value.replace("dBm", "").strip())


def convert(input_file: Path, output_file: Path, x: float, y: float) -> None:
    """Convert one pipe-delimited export and attach its recording coordinates."""
    lines = input_file.read_text(encoding="utf-8").splitlines()
    if not lines:
        raise ValueError("Input file is empty")

    header = lines[0].strip().split("|")
    try:
        bssid_index = header.index("BSSID")
        strength_index = header.index("Strength")
    except ValueError as error:
        raise ValueError("Missing required columns: BSSID or Strength") from error

    wifi_scan_info: dict[str, dict[str, int]] = {}
    for line in lines[1:]:
        if not line.strip():
            continue
        parts = line.strip().split("|")
        if len(parts) <= max(bssid_index, strength_index):
            continue

        bssid = parts[bssid_index].strip().lower()
        wifi_scan_info[bssid] = {"rssi": parse_strength(parts[strength_index])}

    document = {
        "coords": {"x": x, "y": y},
        "wifi_scan_info": wifi_scan_info,
    }
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    print(f"Saved {len(wifi_scan_info)} AP entries to {output_file}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert a WiFi Analyzer export to the saved-scan JSON format"
    )
    parser.add_argument("input_file", type=Path, help="WiFi Analyzer export file")
    parser.add_argument("--x", type=float, required=True, help="Recording X coordinate")
    parser.add_argument("--y", type=float, required=True, help="Recording Y coordinate")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output JSON filename (default: {DEFAULT_OUTPUT})",
    )
    args = parser.parse_args()
    convert(args.input_file, args.output, args.x, args.y)


if __name__ == "__main__":
    main()
