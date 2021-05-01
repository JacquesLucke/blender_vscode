import os
import sys
import bpy
import runpy
import traceback
from pathlib import Path

vscode_address = os.environ['VSCODE_ADDRESS']
want_to_attach_python_debugger = "WANT_TO_ATTACH_PYTHON_DEBUGGER" in os.environ

addon_name = "blender_vscode_addon"

source_dir = Path(__file__).parent
addons_dir = Path(bpy.utils.user_resource('SCRIPTS', "addons"))
vscode_addon_source_path = source_dir / addon_name
vscode_addon_destination_path = addons_dir / addon_name

install_utils = runpy.run_path(vscode_addon_source_path / "install_utils.py")
install_utils["sync_directories"](
    vscode_addon_source_path,
    vscode_addon_destination_path,
    verbose=True,
    ignore_cb=lambda path: str(path).lower().endswith(".pyc") or str(path).lower().endswith("__pycache__"))

import blender_vscode_addon
blender_vscode_addon.addon_reload.reload_addon(addon_name)

# Import again, because it has been reloaded.
import blender_vscode_addon
blender_vscode_addon.communication.set_vscode_address(vscode_address)
blender_vscode_addon.communication.ensure_server_is_running()
blender_vscode_addon.preferences.send_connection_info()

from blender_vscode_addon.package_installation import is_package_installed, blender_uses_own_python

if want_to_attach_python_debugger:
    if not is_package_installed("debugpy"):
        if blender_uses_own_python():
            if not is_package_installed("pip"):
                bpy.ops.development.install_pip()
            bpy.ops.development.install_python_package(package_name="debugpy")
        else:
            print("Error: Please install debugpy before trying to attach the debugger.")
            print("Did not try to install debugpy automatically, because Blender does not use its own Python.")
            sys.exit(1)

    bpy.ops.development.start_debugpy_server()
    blender_vscode_addon.preferences.send_connection_info()
    import debugpy
    blender_vscode_addon.communication.send_command("/attach_debugpy")
    print("Waiting for Python debugger to attach.")
    debugpy.wait_for_client()
    print("Attached.")
