import os
import bpy
import sys
import traceback
from pathlib import Path
from . communication import send_dict_as_json
from . environment import user_addon_directory, addon_directories

def setup_addon_links(addon_paths):
    if not os.path.exists(user_addon_directory):
        os.makedirs(user_addon_directory)

    path_mappings = []

    for source_path in addon_paths:
        if is_in_any_addon_directory(source_path):
            load_path = source_path
        else:
            load_path = os.path.join(user_addon_directory, source_path.name)
            create_link_in_user_addon_directory(source_path, load_path)

        path_mappings.append({
            "src": str(source_path),
            "load": str(load_path)
        })

    return path_mappings

def load(addon_paths):
    for addon_path in addon_paths:
        try:
            bpy.ops.wm.addon_enable(module=addon_path.name)
        except:
            traceback.print_exc()
            send_dict_as_json({"type" : "enableFailure", "addonPath" : str(addon_path)})

def create_link_in_user_addon_directory(directory, link_path):
    if os.path.exists(link_path):
        os.remove(link_path)

    if sys.platform == "win32":
        import _winapi
        _winapi.CreateJunction(str(directory), str(link_path))
    else:
        os.symlink(str(directory), str(link_path), target_is_directory=True)

def is_in_any_addon_directory(module_path):
    for path in addon_directories:
        if path == module_path.parent:
            return True
    return False
