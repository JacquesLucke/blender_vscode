import atexit
import os
import sys
import traceback
from pathlib import Path
from typing import List, Tuple, Union, Optional, Dict

import bpy

from . import AddonInfo
from .communication import send_dict_as_json
from .environment import addon_directories, KEEP_ADDON_INSTALLED, EXTENSIONS_REPOSITORY
from .modify_blender import (
    disable_copy_settings_from_previous_version,
    disable_addon_remove,
)
from .utils_blender import is_addon_legacy, addon_has_bl_info
from .utils_files import resolve_link

if bpy.app.version >= (4, 2, 0):
    _EXTENSIONS_DEFAULT_DIR = Path(bpy.utils.user_resource("EXTENSIONS", path=EXTENSIONS_REPOSITORY))
else:
    _EXTENSIONS_DEFAULT_DIR = None
_ADDONS_DEFAULT_DIR = Path(bpy.utils.user_resource("SCRIPTS", path="addons"))


def setup_addon_links(addons_to_load: List[AddonInfo]) -> Tuple[List[Dict], List[Dict]]:
    # always make sure addons are in path, important when running fresh blender install
    # do it always to avoid very confusing logic in the loop below
    os.makedirs(_ADDONS_DEFAULT_DIR, exist_ok=True)
    if str(_ADDONS_DEFAULT_DIR) not in sys.path:
        sys.path.append(str(_ADDONS_DEFAULT_DIR))

    remove_broken_addon_links()
    if bpy.app.version >= (4, 2, 0):
        ensure_extension_repo_exists(EXTENSIONS_REPOSITORY)
        remove_broken_extension_links()

    if sys.platform == "win32":
        # todo disable copy settings only when there is a junction in blender config folder
        disable_copy_settings_from_previous_version()
        disable_addon_remove()

    path_mappings: List[Dict] = []
    load_status: List[Dict] = []
    for addon_info in addons_to_load:
        try:
            load_path = _link_addon_or_extension(addon_info)
        except PermissionError as e:
            print(
                f"""ERROR: {e} 
Path "{e.filename}" can not be removed. **Please remove it manually!** Most likely causes:
    - Path requires admin permissions to remove
    - Windows only: You upgraded Blender version and imported old setting. Now links became real directories.
    - Path is a real directory with the same name as addon (removing might cause data loss!)"""
            )
            load_status.append({"type": "enableFailure", "addonPath": str(addon_info.load_dir)})
        except Exception:
            traceback.print_exc()
            load_status.append({"type": "enableFailure", "addonPath": str(addon_info.load_dir)})
        else:
            path_mappings.append({"src": str(addon_info.load_dir), "load": str(load_path)})

    return path_mappings, load_status


def _link_addon_or_extension(addon_info: AddonInfo) -> Path:
    if is_addon_legacy(addon_info.load_dir):
        if is_in_any_addon_directory(addon_info.load_dir):
            # blender knows about addon and can load it
            load_path = addon_info.load_dir
        else:  # addon is in external dir or is in extensions dir
            _remove_duplicate_addon_links(addon_info)
            load_path = _ADDONS_DEFAULT_DIR / addon_info.module_name
            create_link(addon_info.load_dir, load_path)
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
            _remove_duplicate_extension_links(addon_info)
            os.makedirs(_EXTENSIONS_DEFAULT_DIR, exist_ok=True)
            load_path = _EXTENSIONS_DEFAULT_DIR / addon_info.module_name
            create_link(addon_info.load_dir, load_path)
    return load_path


def _remove_duplicate_addon_links(addon_info: AddonInfo):
    existing_addon_with_the_same_target = does_addon_link_exist(addon_info.load_dir)
    while existing_addon_with_the_same_target:
        if existing_addon_with_the_same_target:
            print("INFO: Removing old link:", existing_addon_with_the_same_target)
            os.remove(existing_addon_with_the_same_target)
        existing_addon_with_the_same_target = does_addon_link_exist(addon_info.load_dir)


def _remove_duplicate_extension_links(addon_info: AddonInfo):
    existing_extension_with_the_same_target = does_extension_link_exist(addon_info.load_dir)
    while existing_extension_with_the_same_target:
        if existing_extension_with_the_same_target:
            print("INFO: Removing old link:", existing_extension_with_the_same_target)
            os.remove(existing_extension_with_the_same_target)
        existing_extension_with_the_same_target = does_extension_link_exist(addon_info.load_dir)


def does_addon_link_exist(development_directory: Path) -> Optional[Path]:
    """Search default addon path and return first path that links to `development_directory`"""
    for file in os.listdir(_ADDONS_DEFAULT_DIR):
        existing_addon_dir = Path(_ADDONS_DEFAULT_DIR, file)
        target = resolve_link(existing_addon_dir)
        if target:
            windows_being_windows = target.lstrip(r"\\?")
            if Path(windows_being_windows) == Path(development_directory):
                return existing_addon_dir
    return None


def does_extension_link_exist(development_directory: Path) -> Optional[Path]:
    """Search all available extension paths and return path that links to `development_directory`"""
    for repo in bpy.context.preferences.extensions.repos:
        if not repo.enabled:
            continue
        repo_dir = repo.custom_directory if repo.use_custom_directory else repo.directory
        if not os.path.isdir(repo_dir):
            continue  # repo dir might not exist
        for file in os.listdir(repo_dir):
            existing_extension_dir = Path(repo_dir, file)
            target = resolve_link(existing_extension_dir)
            if target:
                windows_being_windows = target.lstrip(r"\\?")
                if Path(windows_being_windows) == Path(development_directory):
                    return existing_extension_dir
    return None


def ensure_extension_repo_exists(extensions_repository: str):
    for repo in bpy.context.preferences.extensions.repos:
        repo: bpy.types.UserExtensionRepo
        if repo.module == extensions_repository:
            return repo
    print(f'DEBUG: new extensions repository "{extensions_repository}" created')
    return bpy.context.preferences.extensions.repos.new(name=extensions_repository, module=extensions_repository)


def remove_broken_addon_links():
    for file in os.listdir(_ADDONS_DEFAULT_DIR):
        addon_dir = _ADDONS_DEFAULT_DIR / file
        if not addon_dir.is_dir():
            continue
        target = resolve_link(addon_dir)
        if target and not os.path.exists(target):
            print("INFO: Removing invalid link:", addon_dir, "->", target)
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
            target = resolve_link(existing_extension_dir)
            if target and not os.path.exists(target):
                print("INFO: Removing invalid link:", existing_extension_dir, "->", target)
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
        elif addon_has_bl_info(addon_info.load_dir) and is_in_any_addon_directory(addon_info.load_dir):
            # this addon is compatible with legacy addons and extensions
            # but user is developing it in addon directory. Treat it as addon.
            bpy.ops.preferences.addon_refresh()
            addon_name = addon_info.module_name
        else:
            bpy.ops.extensions.repo_refresh_all()
            addon_name = "bl_ext." + EXTENSIONS_REPOSITORY + "." + addon_info.module_name

        try:
            bpy.ops.preferences.addon_enable(module=addon_name)
        except Exception:
            traceback.print_exc()
            send_dict_as_json({"type": "enableFailure", "addonPath": str(addon_info.load_dir)})


def create_link(directory: Union[str, os.PathLike], link_path: Union[str, os.PathLike]):
    if os.path.exists(link_path):
        os.remove(link_path)

    if sys.platform == "win32":
        import _winapi

        _winapi.CreateJunction(str(directory), str(link_path))
    else:
        os.symlink(str(directory), str(link_path), target_is_directory=True)

    if KEEP_ADDON_INSTALLED:
        return

    def cleanup():
        if not os.path.exists(link_path):
            return
        try:
            print(f'INFO: Cleanup: remove link: "{link_path}"')
            os.remove(link_path)
        except PermissionError as ex:
            print(
                f'ERROR: Could not remove path "{link_path}" due to insufficient permission. Please remove it manually.'
            )
            raise ex

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
