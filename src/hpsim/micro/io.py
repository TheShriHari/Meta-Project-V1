"""
src/hpsim/micro/io.py - Micrograph metadata and image loader with scale-bar calibration.
"""

import csv
import os
from dataclasses import dataclass
from typing import List, Tuple
import cv2
import numpy as np


@dataclass(frozen=True)
class MicrographMetadata:
    """Calibrated metadata for a metallographic image from data/micrographs/metadata.csv."""
    filename: str
    filepath: str
    material_key: str
    material_name: str
    structure: str
    phase_of_interest: str
    heat_treatment: str
    etchant: str
    magnification: str
    scale_bar_um: float
    pixels_for_scale_bar: float
    pixel_size_m: float
    license_note: str
    redistributable_raw: bool


_MATERIAL_KEY_MAP = {
    "aluminium_al995_doitpoms609.jpg": (
        "aluminium",
        "CC BY-NC-SA 4.0 (DoITPoMS #609) - Local research only; raw image not bundled in web/public/",
        False,
    ),
    "copper_cu997_doitpoms436.jpg": (
        "copper",
        "CC BY-NC-SA 4.0 (DoITPoMS #436) - Local research only; raw image not bundled in web/public/",
        False,
    ),
    "ferritic_steel_fe202.jpg": (
        "ferritic_steel",
        "CC BY-NC-SA 4.0 (DoITPoMS #202) - Local research only; raw image not bundled in web/public/",
        False,
    ),
    "pure_iron_ferpur100x.jpg": (
        "pure_iron",
        "CC BY-SA 3.0 (Wikimedia Commons Fer_pur_100x.jpg)",
        True,
    ),
}


def load_micrograph_metadata(
    csv_path: str = "data/micrographs/metadata.csv",
) -> List[MicrographMetadata]:
    """Load and validate micrograph calibration metadata from CSV."""
    base_dir = os.path.dirname(os.path.abspath(csv_path))
    records: List[MicrographMetadata] = []

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            fname = row["file"].strip()
            fpath = os.path.join(base_dir, fname)
            scale_um = float(row["scale_bar_um"])
            scale_px = float(row["pixels_for_scale_bar"])
            if scale_um <= 0.0 or scale_px <= 0.0:
                raise ValueError(f"Invalid scale calibration for {fname}")
            px_size_m = (scale_um * 1.0e-6) / scale_px
            mat_key, lic_note, redist = _MATERIAL_KEY_MAP.get(
                fname, (fname.split("_")[0], "Unknown license", False)
            )
            records.append(
                MicrographMetadata(
                    filename=fname,
                    filepath=fpath,
                    material_key=mat_key,
                    material_name=row["material"].strip(),
                    structure=row["structure"].strip(),
                    phase_of_interest=row["phase_of_interest"].strip(),
                    heat_treatment=row["heat_treatment"].strip(),
                    etchant=row["etchant"].strip(),
                    magnification=row["magnification"].strip(),
                    scale_bar_um=scale_um,
                    pixels_for_scale_bar=scale_px,
                    pixel_size_m=px_size_m,
                    license_note=lic_note,
                    redistributable_raw=redist,
                )
            )
    return records


def load_micrograph_image(
    meta: MicrographMetadata,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Load micrograph image, crop scale-bar legend banner so only clean microstructure
    is analyzed, and return (rgb_uint8, gray_uint8) while preserving exact pixel_size_m.
    """
    bgr = cv2.imread(meta.filepath, cv2.IMREAD_COLOR)
    if bgr is None:
        raise FileNotFoundError(f"Could not read micrograph at {meta.filepath}")

    h, w = bgr.shape[:2]
    # Remove bottom scale-bar banner strip on DoITPoMS / embedded scale bar micrographs
    if meta.filename in ("copper_cu997_doitpoms436.jpg", "ferritic_steel_fe202.jpg"):
        bgr = bgr[:490, :780]
    elif meta.filename == "aluminium_al995_doitpoms609.jpg":
        bgr = bgr[:455, :490]
    elif h > 900 or w > 900:
        # Extract clean central 600x800 region at native resolution (preserving pixel_size_m)
        y0 = (h - 600) // 2
        x0 = (w - 800) // 2
        bgr = bgr[y0 : y0 + 600, x0 : x0 + 800]

    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    return rgb, gray
