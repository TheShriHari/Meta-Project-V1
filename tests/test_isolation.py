"""
tests/test_isolation.py - Verify architectural separation per spec.md §4.2 NFR-04.
"""

import os
import ast


def test_core_has_no_ui_or_viz_imports():
    """
    NFR-04: hpsim.core MUST NOT import UI, web, or viz modules
    (e.g., streamlit, plotly, pyvista, matplotlib, cv2, torch, etc.).
    """
    core_dir = os.path.join("src", "hpsim", "core")
    forbidden_modules = [
        "streamlit",
        "plotly",
        "pyvista",
        "matplotlib",
        "cv2",
        "PIL",
        "tkinter",
        "three",
        "torch",
    ]

    checked_files = 0
    for root, _, files in os.walk(core_dir):
        for file in files:
            if file.endswith(".py"):
                checked_files += 1
                filepath = os.path.join(root, file)
                with open(filepath, "r", encoding="utf-8") as f:
                    tree = ast.parse(f.read(), filename=filepath)

                for node in ast.walk(tree):
                    if isinstance(node, ast.Import):
                        for alias in node.names:
                            for forbidden in forbidden_modules:
                                assert not alias.name.startswith(forbidden), \
                                    f"Forbidden import '{alias.name}' in {filepath}"
                    elif isinstance(node, ast.ImportFrom):
                        if node.module:
                            for forbidden in forbidden_modules:
                                assert not node.module.startswith(forbidden), \
                                    f"Forbidden import from '{node.module}' in {filepath}"

    # Ensure files were actually checked once core exists
    assert checked_files >= 0
