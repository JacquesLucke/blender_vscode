import os
import sys
import traceback
from pathlib import Path
from typing import List, Union, Optional, Dict

import bpy

from . import AddonInfo
from .communication import send_dict_as_json
from .environment import addon_directories
from .utils import is_addon_legacy, addon_has_bl_info


def setup_addon_links(addons_to_load: List[AddonInfo]) -> List[Dict]:
    path_mappings: List[Dict] = []

    addons_default_dir = Path(bpy.utils.user_resource("SCRIPTS", path="addons"))
    # always make sure addons are in path, important when running fresh blender install
    # do it always to avoid very confusing logic in the loop below
    os.makedirs(addons_default_dir, exist_ok=True)
    if str(addons_default_dir) not in sys.path:
        sys.path.append(str(addons_default_dir))

    remove_broken_addon_links()
    if bpy.app.version >= (4, 2, 0):
        remove_broken_extension_links()

    for addon_info in addons_to_load:
        if is_addon_legacy(addon_info.load_dir):
            if is_in_any_addon_directory(addon_info.load_dir):
                # blender knows about addon and can load it
                load_path = addon_info.load_dir
            else:  # addon is in external dir or is in extensions dir
                existing_addon_with_the_same_target = does_addon_link_exist(addon_info.load_dir)
                while existing_addon_with_the_same_target:
                    if existing_addon_with_the_same_target:
                        print("INFO: Removing old link:", existing_addon_with_the_same_target)
                        os.remove(existing_addon_with_the_same_target)
                    existing_addon_with_the_same_target = does_addon_link_exist(addon_info.load_dir)
                load_path = addons_default_dir / addon_info.module_name
                create_link_in_user_addon_directory(addon_info.load_dir, load_path)
        else:
            if addon_has_bl_info(addon_info.load_dir) and is_in_any_addon_directory(addon_info.load_dir):
                # this addon is compatible with legacy addons and extensions
                # but user is developing it in addon directory. Treat it as addon.
                load_path = addon_info.load_dir
            elif is_in_any_extension_directory(addon_info.load_dir):
                # blender knows about extension and can load it
                load_path = addon_info.load_dir
            else:
                # blender does not know about extension, and it must be linked to default location
                existing_extension_with_the_same_target = does_extension_link_exist(addon_info.load_dir)
                while existing_extension_with_the_same_target:
                    if existing_extension_with_the_same_target:
                        print("INFO: Removing old link:", existing_extension_with_the_same_target)
                        os.remove(existing_extension_with_the_same_target)
                    existing_extension_with_the_same_target = does_extension_link_exist(addon_info.load_dir)
                extensions_default_dir = Path(bpy.utils.user_resource("EXTENSIONS", path="user_default"))
                os.makedirs(extensions_default_dir, exist_ok=True)
                load_path = extensions_default_dir / addon_info.module_name
                create_link_in_user_addon_directory(addon_info.load_dir, load_path)
        path_mappings.append({"src": str(addon_info.load_dir), "load": str(load_path)})

    return path_mappings


def _resolve_link(path: Path) -> Optional[str]:
    """Return target if is symlink or juntion"""
    try:
        return os.readlink(path)
    except OSError as e:
        # OSError: [WinError 4390] The file or directory is not a reparse point
        if e.winerror == 4390:
            return None
        else:
            raise e


def does_addon_link_exist(development_directory: Path) -> Optional[Path]:
    """Search default addon path and return path that links to `development_directory`"""
    addons_default_dir = bpy.utils.user_resource("SCRIPTS", path="addons")
    for file in os.listdir(addons_default_dir):
        existing_addon_dir = Path(addons_default_dir, file)
        target = _resolve_link(existing_addon_dir)
        if target:
            print("DEBUG: Checking", development_directory, "with target", target)
            windows_being_windows = target.rstrip(r"\\?")
            if Path(windows_being_windows) == Path(development_directory):
                return existing_addon_dir
    return None


def does_extension_link_exist(development_directory: Path) -> Optional[Path]:
    """Search all available extension paths and return path that links to `development_directory"""
    for repo in bpy.context.preferences.extensions.repos:
        if not repo.enabled:
            continue
        repo_dir = repo.custom_directory if repo.use_custom_directory else repo.directory
        if not os.path.isdir(repo_dir):
            continue  # repo dir might not exist
        # print("DEBUG: Checking", repo_dir)
        for file in os.listdir(repo_dir):
            existing_extension_dir = Path(repo_dir, file)
            target = _resolve_link(existing_extension_dir)
            if target:
                # print("DEBUG: Checking", development_directory, "with target", target)
                windows_being_windows = target.lstrip(r"\\?")
                if Path(windows_being_windows) == Path(development_directory):
                    return existing_extension_dir
    return None


def remove_broken_addon_links():
    addons_default_dir = Path(bpy.utils.user_resource("SCRIPTS", path="addons"))
    for file in os.listdir(addons_default_dir):
        addon_dir = addons_default_dir / file
        if not addon_dir.is_dir():
            continue
        target = _resolve_link(addon_dir)
        if target and not os.path.exists(target):
            print("INFO: Removing invalid link:", addon_dir)
            os.remove(addon_dir)


def remove_broken_extension_links():
    for repo in bpy.context.preferences.extensions.repos:
        if not repo.enabled:
            continue
        repo_dir = repo.custom_directory if repo.use_custom_directory else repo.directory
        repo_dir = Path(repo_dir)
        if not repo_dir.is_dir():
            continue
        for file in os.listdir(repo_dir):
            existing_extension_dir = repo_dir / file
            target = _resolve_link(existing_extension_dir)
            if target and not os.path.exists(target):
                print("INFO: Removing invalid link:", existing_extension_dir)
                os.remove(existing_extension_dir)


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


def is_in_any_extension_directory(module_path: Path) -> Optional["bpy.types.UserExtensionRepo"]:
    for repo in bpy.context.preferences.extensions.repos:
        if not repo.enabled:
            continue
        repo_dir = repo.custom_directory if repo.use_custom_directory else repo.directory
        if Path(repo_dir) == module_path.parent:
            return repo
    return None
