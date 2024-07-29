import os
import sys
import traceback
from pathlib import Path
from typing import List, Union, Optional, Dict

import bpy

from . import AddonInfo
from .communication import send_dict_as_json
from .environment import addon_directories
from .utils import is_addon_legacy


def setup_addon_links(addons_to_load: List[AddonInfo]) -> List[Dict]:
    path_mappings: List[Dict] = []

    for addon_info in addons_to_load:
        default_directory = get_user_addon_directory(Path(addon_info.load_dir))
        if is_addon_legacy(Path(addon_info.load_dir)):
            if is_in_any_addon_directory(addon_info.load_dir):
                # blender knows about addon and can load it
                load_path = addon_info.load_dir
            else:  # is in external dir of is in extensions dir
                load_path = os.path.join(default_directory, addon_info.module_name)
                if str(load_path) not in sys.path:
                    sys.path.append(str(load_path))
                create_link_in_user_addon_directory(addon_info.load_dir, load_path)
        else:
            if is_in_any_extension_directory(Path(addon_info.load_dir)):
                # blender knows about extension and can load it
                load_path = addon_info.load_dir
            else:
                os.makedirs(default_directory, exist_ok=True)
                load_path = os.path.join(default_directory, addon_info.module_name)
                if str(load_path) not in sys.path:
                    sys.path.append(str(load_path))
                create_link_in_user_addon_directory(addon_info.load_dir, load_path)

        path_mappings.append({"src": str(addon_info.load_dir), "load": str(load_path)})

    return path_mappings


def get_user_addon_directory(source_path: Path):
    """Return either the user scripts or user extensions directory depending on the addon type."""
    if is_addon_legacy(source_path):
        return Path(bpy.utils.user_resource("SCRIPTS", path="addons"))
    else:
        return Path(bpy.utils.user_resource("EXTENSIONS", path="user_default"))


def load(addons_to_load: List[AddonInfo]):
    for addon_info in addons_to_load:
        if is_addon_legacy(Path(addon_info.load_dir)):
            bpy.ops.preferences.addon_refresh()
            addon_name = addon_info.module_name
        else:
            bpy.ops.extensions.repo_refresh_all()
            repo = is_in_any_extension_directory(addon_info.load_dir)
            module = getattr(repo, "module", "user_default")
            addon_name = ".".join(("bl_ext", module, addon_info.module_name))
        try:
            bpy.ops.preferences.addon_enable(module=addon_name)
        except Exception:
            traceback.print_exc()
            send_dict_as_json({"type": "enableFailure", "addonPath": str(addon_info.load_dir)})


def create_link_in_user_addon_directory(directory: Union[str, os.PathLike], link_path: Union[str, os.PathLike]):
    if os.path.exists(link_path):
        os.remove(link_path)

    if sys.platform == "win32":
        import _winapi

        _winapi.CreateJunction(str(directory), str(link_path))
    else:
        os.symlink(str(directory), str(link_path), target_is_directory=True)


def is_in_any_addon_directory(module_path: Path) -> bool:
    for path in addon_directories:
        if path == module_path.parent:
            return True
    return False


def is_in_any_extension_directory(module_path: Path) -> Optional[bpy.types.UserExtensionRepo]:
    for repo in bpy.context.preferences.extensions.repos:
        if not repo.enabled:
            continue
        repo_dir = repo.custom_directory if repo.use_custom_directory else repo.directory
        if Path(repo_dir) == module_path.parent:
            return repo
    return None
