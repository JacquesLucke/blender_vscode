import os
import sys
import traceback
from pathlib import Path

import bpy

from . import AddonInfo
from .communication import send_dict_as_json
from .environment import addon_directories
from .utils import is_addon_legacy


def setup_addon_links(addons_to_load: list[AddonInfo]):

    path_mappings = []

    for addon_info in addons_to_load:
        user_addon_directory = get_user_addon_directory(Path(addon_info.load_dir))
        print(f"USER ADDON: {user_addon_directory}")

        if not os.path.exists(user_addon_directory):
            os.makedirs(user_addon_directory)

        if is_addon_legacy(Path(addon_info.load_dir)) and not str(user_addon_directory) in sys.path:
            sys.path.append(str(user_addon_directory))

        if is_in_any_addon_directory(addon_info.load_dir):
            load_path = addon_info.load_dir
        else:
            load_path = os.path.join(user_addon_directory, addon_info.module_name)
            create_link_in_user_addon_directory(addon_info.load_dir, load_path)

        path_mappings.append({"src": str(addon_info.load_dir), "load": str(load_path)})

    return path_mappings


def get_user_addon_directory(source_path: Path):
    """Return either the user scripts or user extensions directory depending on the addon type."""
    if is_addon_legacy(source_path):
        return Path(bpy.utils.user_resource("SCRIPTS", path="addons"))
    else:
        return Path(bpy.utils.user_resource("EXTENSIONS", path="user_default"))


def load(addons_to_load: list[AddonInfo]):
    for addon_info in addons_to_load:
        if is_addon_legacy(Path(addon_info.load_dir)):
            bpy.ops.preferences.addon_refresh()
            addon_name = addon_info.module_name
        else:
            bpy.ops.extensions.repo_refresh_all()
            addon_name = "bl_ext.user_default." + addon_info.module_name

        try:
            bpy.ops.preferences.addon_enable(module=addon_name)
        except Exception:
            traceback.print_exc()
            send_dict_as_json({"type": "enableFailure", "addonPath": str(addon_info.load_dir)})


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
