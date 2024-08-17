import bpy
import sys
import addon_utils
from pathlib import Path
import platform

# binary_path_python was removed in blender 2.92
# but it is the most reliable way of getting python path for older versions
# https://github.com/JacquesLucke/blender_vscode/issues/80
python_path = Path(getattr(bpy.app, "binary_path_python", sys.executable))
blender_path = Path(bpy.app.binary_path)
blender_directory = blender_path.parent

version = bpy.app.version
scripts_folder = blender_path.parent / f"{version[0]}.{version[1]}" / "scripts"
addon_directories = tuple(map(Path, addon_utils.paths()))
