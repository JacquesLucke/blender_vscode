import os
import bpy
import sys
import traceback
from pathlib import Path
from . environment import addon_directory
from . communication import send_dict_as_json

def load(addon_paths):
    if not os.path.exists(addon_directory):
        os.makedirs(addon_directory)

    for addon_path in addon_paths:
        if not is_in_sys_path(addon_path):
            create_link_in_addon_directory(addon_path)

        try:
            bpy.ops.wm.addon_enable(module=Path(addon_path).name)
        except:
            traceback.print_exc()
            send_dict_as_json({"type" : "enableFailure", "addonPath" : str(addon_path)})

def create_link_in_addon_directory(directory):
    link_path = os.path.join(addon_directory, Path(directory).name)

    if os.path.exists(link_path):
        os.remove(link_path)

    if sys.platform == "win32":
        import _winapi
        _winapi.CreateJunction(directory, link_path)
    else:
        os.symlink(directory, link_path, target_is_directory=True)

def is_in_sys_path(module_path):
    for path in sys.path:
        if Path(path) == Path(module_path).parent:
            return True
    return False
