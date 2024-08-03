import atexit
import os
import sys
import traceback
from pathlib import Path
from typing import List, Tuple, Union, Optional, Dict

import bpy

from . import AddonInfo
from .communication import send_dict_as_json
from .environment import addon_directories
from .utils import is_addon_legacy, addon_has_bl_info


def fake_poll(*args, **kwargs):
    return False


def setup_addon_links(addons_to_load: List[AddonInfo]) -> Tuple[List[Dict], List[Dict]]:
    path_mappings: List[Dict] = []

    addons_default_dir = bpy.utils.user_resource("SCRIPTS", path="addons")
    # always make sure addons are in path, important when running fresh blender install
    # do it always to avoid very confusing logic in the loop below
    os.makedirs(addons_default_dir, exist_ok=True)
    if str(addons_default_dir) not in sys.path:
        sys.path.append(str(addons_default_dir))

    load_status: List[Dict] = []
    # disable bpy.ops.preferences.copy_prev() is not happy with links that are about to be crated
    bpy.types.PREFERENCES_OT_copy_prev.poll = fake_poll
    for addon_info in addons_to_load:
        try:
            if is_addon_legacy(addon_info.load_dir):
                if is_in_any_addon_directory(addon_info.load_dir):
                    # blender knows about addon and can load it
                    load_path = addon_info.load_dir
                else:  # addon is in external dir or is in extensions dir
                    load_path = os.path.join(addons_default_dir, addon_info.module_name)
                    make_temporary_link(addon_info.load_dir, load_path)
            else:
                if addon_has_bl_info(addon_info.load_dir) and is_in_any_addon_directory(addon_info.load_dir):
                    # this addon is compatible with legacy addons and extensions
                    # but user is developing it in addon directory. Treat it as addon.
                    load_path = addon_info.load_dir
                elif is_in_any_extension_directory(addon_info.load_dir):
                    # blender knows about extension and can load it
                    load_path = addon_info.load_dir
                else:
                    extensions_default_dir = Path(bpy.utils.user_resource("EXTENSIONS", path="user_default"))
                    # blender does not know about extension, and it must be linked to default location
                    os.makedirs(extensions_default_dir, exist_ok=True)
                    load_path = os.path.join(extensions_default_dir, addon_info.module_name)
                    make_temporary_link(addon_info.load_dir, load_path)
            path_mappings.append({"src": str(addon_info.load_dir), "load": str(load_path)})
        except Exception:
            load_status.append({"type": "enableFailure", "addonPath": str(addon_info.load_dir)})
        else:
            path_mappings.append({"src": str(addon_info.load_dir), "load": str(load_path)})

    return path_mappings, load_status


def load(addons_to_load: List[AddonInfo]):
    for addon_info in addons_to_load:
        if is_addon_legacy(Path(addon_info.load_dir)):
            bpy.ops.preferences.addon_refresh()
            addon_name = addon_info.module_name
        elif addon_has_bl_info(addon_info.load_dir) and is_in_any_addon_directory(addon_info.load_dir):
            # this addon is compatible with legacy addons and extensions
            # but user is developing it in addon directory. Treat it as addon.
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


def make_temporary_link(directory: Union[str, os.PathLike], link_path: Union[str, os.PathLike]):
    def cleanup():
        if not os.path.exists(link_path):
            return
        try:
            os.remove(link_path)
        except PermissionError as ex:
            print(
                f'ERROR: Could not remove path "{link_path}" due to insufficient permission. Please remove it manually.'
            )
            raise ex

    cleanup()
    if sys.platform == "win32":
        import _winapi

        _winapi.CreateJunction(str(directory), str(link_path))
    else:
        os.symlink(str(directory), str(link_path), target_is_directory=True)

    atexit.register(cleanup)


def is_in_any_addon_directory(module_path: Path) -> bool:
    for path in addon_directories:
        if path == module_path.parent:
            return True
    return False


def is_in_any_extension_directory(module_path: Path) -> Optional["bpy.types.UserExtensionRepo"]:
    for repo in bpy.context.preferences.extensions.repos:
        if not repo.enabled:
            continue
        repo_dir = repo.custom_directory if repo.use_custom_directory else repo.directory
        if Path(repo_dir) == module_path.parent:
            return repo
    return None
