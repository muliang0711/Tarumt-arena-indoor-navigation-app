"""Reproduce and plot the obsolete LDPL multilateration experiment."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.lines import Line2D
from matplotlib.patches import Circle
from scipy.optimize import least_squares


TX_POWER = -45
PATH_LOSS_EXPONENTS = (2.0, 2.5, 3.0, 4.0)

ROOT = Path(__file__).resolve().parent
AP_LOCATIONS_PATH = ROOT / "ap-locations.json"
SCAN_DIRECTORY = ROOT / "saved-wifi-scans"
OUTPUT_DIRECTORY = ROOT / "outputs"


@dataclass(frozen=True)
class ScanDefinition:
    filename: str
    label: str
    color: str


SCAN_DEFINITIONS = (
    ScanDefinition("north-center.json", "North center", "tab:orange"),
    ScanDefinition("south-center.json", "South center", "tab:green"),
    ScanDefinition("staircase1.json", "Staircase 1", "tab:purple"),
    ScanDefinition("staircase2.json", "Staircase 2", "tab:red"),
)


@dataclass(frozen=True)
class ScanResult:
    definition: ScanDefinition
    path_loss_exponent: float
    actual: np.ndarray
    predicted: np.ndarray
    predicted_distances: dict[str, float]


def rssi_to_distance(
    rssi: float,
    tx_power: float = TX_POWER,
    path_loss_exponent: float = 2.0,
) -> float:
    """Convert RSSI to an LDPL distance estimate."""
    if path_loss_exponent <= 0:
        raise ValueError("path_loss_exponent must be greater than zero")
    return 10.0 ** ((tx_power - rssi) / (10.0 * path_loss_exponent))


def multilateration_3d(
    ap_positions: np.ndarray,
    distances: np.ndarray,
) -> np.ndarray:
    """Return the least-squares point for the supplied AP distance estimates."""
    if len(ap_positions) < 3:
        raise ValueError("At least three matched APs are required")

    def residuals(point: np.ndarray) -> np.ndarray:
        return np.linalg.norm(point - ap_positions, axis=1) - distances

    initial_guess = np.mean(ap_positions, axis=0)
    result = least_squares(residuals, initial_guess)
    if not result.success:
        raise RuntimeError(f"Multilateration failed: {result.message}")
    return result.x


def load_ap_locations(path: Path = AP_LOCATIONS_PATH) -> dict[str, dict[str, float]]:
    document = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(document, dict) or len(document) != 8:
        raise ValueError("ap-locations.json must contain exactly eight APs")

    locations: dict[str, dict[str, float]] = {}
    for bssid, value in document.items():
        if not isinstance(value, dict) or not all(axis in value for axis in ("x", "y", "z")):
            raise ValueError(f"Invalid coordinates for AP {bssid}")
        locations[bssid.lower()] = {
            axis: float(value[axis]) for axis in ("x", "y", "z")
        }
    return locations


def load_scan(path: Path) -> tuple[np.ndarray, dict[str, float]]:
    document: Any = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(document, dict):
        raise ValueError(f"{path.name} must contain a JSON object")

    coords = document.get("coords")
    wifi_scan_info = document.get("wifi_scan_info")
    if not isinstance(coords, dict) or not all(axis in coords for axis in ("x", "y")):
        raise ValueError(f"{path.name} must contain numeric coords.x and coords.y")
    if not isinstance(wifi_scan_info, dict):
        raise ValueError(f"{path.name} must contain a wifi_scan_info mapping")

    try:
        actual = np.asarray([float(coords["x"]), float(coords["y"])], dtype=float)
        readings = {
            str(bssid).lower(): float(reading["rssi"])
            for bssid, reading in wifi_scan_info.items()
        }
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError(f"Invalid coordinate or RSSI value in {path.name}") from error
    return actual, readings


def calculate_scan_result(
    definition: ScanDefinition,
    ap_locations: dict[str, dict[str, float]],
    path_loss_exponent: float,
) -> ScanResult:
    actual, readings = load_scan(SCAN_DIRECTORY / definition.filename)
    matched_bssids = sorted(ap_locations.keys() & readings.keys())
    if len(matched_bssids) < 3:
        raise ValueError(f"{definition.filename} has fewer than three matched APs")

    ap_positions = np.asarray(
        [
            (
                ap_locations[bssid]["x"],
                ap_locations[bssid]["y"],
                ap_locations[bssid]["z"],
            )
            for bssid in matched_bssids
        ],
        dtype=float,
    )
    predicted_distances = {
        bssid: rssi_to_distance(
            readings[bssid], path_loss_exponent=path_loss_exponent
        )
        for bssid in matched_bssids
    }
    distances = np.asarray(
        [predicted_distances[bssid] for bssid in matched_bssids], dtype=float
    )
    predicted = multilateration_3d(ap_positions, distances)
    return ScanResult(
        definition,
        path_loss_exponent,
        actual,
        predicted,
        predicted_distances,
    )


def add_access_points(
    axes: plt.Axes,
    ap_locations: dict[str, dict[str, float]],
) -> None:
    # JSON insertion order preserves the AP1-to-AP8 order in ap-locations.json.
    for index, location in enumerate(ap_locations.values(), start=1):
        x = location["x"]
        y = location["y"]
        axes.scatter(x, y, color="tab:blue", marker="o", s=38, zorder=5)
        axes.annotate(
            f"AP{index}",
            (x, y),
            xytext=(5, 5),
            textcoords="offset points",
            color="tab:blue",
            fontsize=8,
            fontweight="bold",
        )


def add_scan_geometry(
    axes: plt.Axes,
    result: ScanResult,
    ap_locations: dict[str, dict[str, float]],
) -> None:
    """Draw RSSI-predicted distance circles plus actual and predicted positions."""
    color = result.definition.color
    actual_x, actual_y = result.actual
    for bssid, predicted_distance in result.predicted_distances.items():
        location = ap_locations[bssid]
        ap_x = location["x"]
        ap_y = location["y"]
        axes.add_patch(
            Circle(
                (ap_x, ap_y),
                predicted_distance,
                fill=False,
                color=color,
                linestyle="--",
                linewidth=1.0,
                alpha=0.24,
                zorder=1,
            )
        )

    axes.scatter(
        actual_x,
        actual_y,
        color=color,
        marker="^",
        s=110,
        edgecolors="black",
        linewidths=0.5,
        zorder=7,
    )
    axes.scatter(
        result.predicted[0],
        result.predicted[1],
        color=color,
        marker="x",
        s=120,
        linewidths=2.2,
        zorder=8,
    )


def configure_axes(axes: plt.Axes, title: str) -> None:
    axes.set_title(title, fontweight="bold")
    axes.set_xlabel("X coordinate")
    axes.set_ylabel("Y coordinate")
    axes.grid(True, linestyle=":", alpha=0.45)
    axes.set_aspect("equal", adjustable="datalim")


def save_individual_plot(
    result: ScanResult,
    ap_locations: dict[str, dict[str, float]],
) -> Path:
    figure, axes = plt.subplots(figsize=(11, 7), constrained_layout=True)
    add_access_points(axes, ap_locations)
    add_scan_geometry(axes, result, ap_locations)
    configure_axes(
        axes,
        f"{result.definition.label}: LDPL prediction (n = {result.path_loss_exponent:g})",
    )
    color = result.definition.color
    axes.legend(
        handles=[
            Line2D([], [], color="tab:blue", marker="o", linestyle="None", label="Access point"),
            Line2D([], [], color=color, linestyle="--", label="RSSI-predicted distance circle"),
            Line2D([], [], color=color, marker="^", linestyle="None", label="Actual scan position"),
            Line2D([], [], color=color, marker="x", linestyle="None", markersize=8, label="LDPL predicted position"),
        ],
        loc="upper right",
    )
    exponent_label = f"{result.path_loss_exponent:g}"
    output_path = OUTPUT_DIRECTORY / (
        f"{Path(result.definition.filename).stem}-n-{exponent_label}.png"
    )
    figure.savefig(output_path, dpi=220, bbox_inches="tight")
    plt.close(figure)
    return output_path


def main() -> None:
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    ap_locations = load_ap_locations()
    results = [
        calculate_scan_result(definition, ap_locations, exponent)
        for exponent in PATH_LOSS_EXPONENTS
        for definition in SCAN_DEFINITIONS
    ]

    output_paths = [
        save_individual_plot(result, ap_locations) for result in results
    ]

    for result in results:
        print(
            f"{result.definition.label}, n={result.path_loss_exponent:g}: "
            f"actual=({result.actual[0]:.2f}, "
            f"{result.actual[1]:.2f}), predicted=({result.predicted[0]:.2f}, "
            f"{result.predicted[1]:.2f}), circles={len(result.predicted_distances)}"
        )
    for path in output_paths:
        print(f"Saved {path}")


if __name__ == "__main__":
    main()
