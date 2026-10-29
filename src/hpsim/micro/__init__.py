"""
src/hpsim/micro/__init__.py - Public API for Phase 7 Micrograph Preprocessing & Geometric Analysis.
"""

from hpsim.micro.io import (
    MicrographMetadata,
    load_micrograph_metadata,
    load_micrograph_image,
)
from hpsim.micro.preprocess import (
    PreprocessedMicrograph,
    preprocess_micrograph,
)
from hpsim.micro.segment import (
    SegmentationResult,
    generate_synthetic_voronoi_labels,
    segment_micrograph,
)
from hpsim.micro.intercept import (
    InterceptResult,
    compute_lineal_intercepts,
)
from hpsim.micro.grains import (
    GrainRecord,
    extract_grains,
)
from hpsim.micro.chords import extract_chord_distribution
from hpsim.micro.orientations import (
    GrainOrientation,
    assign_seeded_orientations,
)
from hpsim.micro.rescale import (
    RescaledChordResult,
    rescale_chords,
    evaluate_chord_ensemble_hall_petch,
)
from hpsim.micro.qa import save_qa_overlay

__all__ = [
    "MicrographMetadata",
    "load_micrograph_metadata",
    "load_micrograph_image",
    "PreprocessedMicrograph",
    "preprocess_micrograph",
    "SegmentationResult",
    "generate_synthetic_voronoi_labels",
    "segment_micrograph",
    "InterceptResult",
    "compute_lineal_intercepts",
    "GrainRecord",
    "extract_grains",
    "extract_chord_distribution",
    "GrainOrientation",
    "assign_seeded_orientations",
    "RescaledChordResult",
    "rescale_chords",
    "evaluate_chord_ensemble_hall_petch",
    "save_qa_overlay",
]
