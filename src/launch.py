import os
import sys
import bpy
import traceback
from pathlib import Path

vscode_address = os.environ['VSCODE_ADDRESS']
want_to_attach_python_debugger = "WANT_TO_ATTACH_PYTHON_DEBUGGER" in os.environ

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

# Import again, because it has been reloaded.
import blender_vscode_addon
blender_vscode_addon.communication.set_vscode_address(vscode_address)
blender_vscode_addon.communication.ensure_server_is_running()
blender_vscode_addon.preferences.send_connection_info()

if want_to_attach_python_debugger:
    if not blender_vscode_addon.package_installation.is_package_installed("ptvsd"):
        print("Error: Please install ptvsd before trying to attach the debugger.")
        sys.exit(1)
    else:
        bpy.ops.development.start_ptvsd_server()
        blender_vscode_addon.preferences.send_connection_info()
        import ptvsd
        blender_vscode_addon.communication.send_command("/attach_ptvsd")
        print("Waiting for Python debugger to attach.")
        ptvsd.wait_for_attach()
        print("Attached.")
