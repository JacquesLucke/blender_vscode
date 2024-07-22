import bpy
import sys
import addon_utils
from pathlib import Path
import platform

PYTHON_PATH = Path(sys.executable)
BLENDER_PATH = Path(bpy.app.binary_path)
blender_directory = BLENDER_PATH.parent

# Test for MacOS app bundles
if platform.system() == "Darwin":
    USE_OWN_PYTHON = blender_directory.parent in PYTHON_PATH.parents
else:
    USE_OWN_PYTHON = blender_directory in PYTHON_PATH.parents

_version = bpy.app.version
SCRIPTS_FOLDER = BLENDER_PATH.parent / f"{_version[0]}.{_version[1]}" / "scripts"
ADDON_DIRECTORIES = tuple(map(Path, addon_utils.paths()))
