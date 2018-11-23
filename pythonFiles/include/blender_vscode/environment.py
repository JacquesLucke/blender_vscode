import bpy
from pathlib import Path

python_path = Path(bpy.app.binary_path_python)
blender_path = Path(bpy.app.binary_path)
blender_directory = blender_path.parent
use_own_python = blender_directory in python_path.parents

version = bpy.app.version
scripts_folder = blender_path.parent / f"{version[0]}.{version[1]}" / "scripts"
addon_directory = bpy.utils.user_resource('SCRIPTS', "addons")
