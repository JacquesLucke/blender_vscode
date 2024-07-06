import bpy
import sys
import addon_utils
from pathlib import Path
import platform

from .utils import is_addon_legacy

python_path = Path(sys.executable)
blender_path = Path(bpy.app.binary_path)
blender_directory = blender_path.parent

# Test for MacOS app bundles
if platform.system()=='Darwin':
    use_own_python = blender_directory.parent in python_path.parents
else:
    use_own_python = blender_directory in python_path.parents

version = bpy.app.version
scripts_folder = blender_path.parent / f"{version[0]}.{version[1]}" / "scripts"


def get_user_addon_directory(source_path: Path):
    if is_addon_legacy(source_path):
        return Path(bpy.utils.user_resource("EXTENSIONS", path="user_default"))
    else:
        return Path(bpy.utils.user_resource('SCRIPTS', path="addons"))


addon_directories = tuple(map(Path, addon_utils.paths()))
