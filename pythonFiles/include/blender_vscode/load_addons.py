import os
import bpy
import sys
import traceback
from pathlib import Path

from .utils import is_addon_legacy
from . communication import send_dict_as_json
from . environment import get_user_addon_directory, addon_directories


def setup_addon_links(addons_to_load: tuple):

    path_mappings = []

    for source_path, module_name in addons_to_load:
        user_addon_directory = get_user_addon_directory(Path(source_path))
        print(f"USER ADDON: {user_addon_directory}")

        if not os.path.exists(user_addon_directory):
            os.makedirs(user_addon_directory)

        if not str(user_addon_directory) in sys.path:
            sys.path.append(str(user_addon_directory))

        if is_in_any_addon_directory(source_path):
            load_path = source_path
        else:
            load_path = os.path.join(user_addon_directory, module_name)
            create_link_in_user_addon_directory(source_path, load_path)

        path_mappings.append({
            "src": str(source_path),
            "load": str(load_path)
        })

    return path_mappings

def load(addons_to_load):
    for source_path, module_name in addons_to_load:
        if is_addon_legacy(Path(source_path)):
            bpy.ops.extensions.repo_refresh_all()
            print(module_name)
            print(module_name)
            print(module_name)
            print(module_name)
            print(module_name)
            print(module_name)
            print(module_name)
            print(module_name)
            print(module_name)
            print(module_name)
            print(module_name)
            print(module_name)
            print(module_name)
            print(module_name)
            print(module_name)

        try:
            bpy.ops.preferences.addon_enable(module=module_name)
        except:
            traceback.print_exc()
            send_dict_as_json({"type" : "enableFailure", "addonPath" : str(source_path)})

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
