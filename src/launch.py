import os
import sys
import bpy
from pathlib import Path

addon_name = "blender_vscode_addon"

source_dir = Path(__file__).parent
addons_dir = Path(bpy.utils.user_resource('SCRIPTS', "addons"))
real_addon_path = source_dir / addon_name
link_addon_path = addons_dir / addon_name

if not link_addon_path.exists():
    if sys.platform == "win32":
        import _winapi
        _winapi.CreateJunction(str(real_addon_path), link_addon_path)
    else:
        os.symlink(str(real_addon_path), str(link_addon_path), target_is_directory=True)

import blender_vscode_addon
blender_vscode_addon.addon_reload.reload_addon(addon_name)
