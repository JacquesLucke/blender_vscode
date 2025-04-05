import os
import subprocess
import sys
import traceback
from pathlib import Path
from typing import List, Union, Optional, Dict

import bpy

from . import AddonInfo, log
from .communication import send_dict_as_json
from .environment import addon_directories, EXTENSIONS_REPOSITORY
from .utils import is_addon_legacy, addon_has_bl_info

LOG = log.getLogger()

if bpy.app.version >= (4, 2, 0):
    _EXTENSIONS_DEFAULT_DIR = Path(bpy.utils.user_resource("EXTENSIONS", path=EXTENSIONS_REPOSITORY))
else:
    _EXTENSIONS_DEFAULT_DIR = None
_ADDONS_DEFAULT_DIR = Path(bpy.utils.user_resource("SCRIPTS", path="addons"))


def setup_addon_links(addons_to_load: List[AddonInfo]) -> List[Dict]:
    path_mappings: List[Dict] = []

    # always make sure addons are in path, important when running fresh blender install
    # do it always to avoid very confusing logic in the loop below
    os.makedirs(_ADDONS_DEFAULT_DIR, exist_ok=True)
    if str(_ADDONS_DEFAULT_DIR) not in sys.path:
        sys.path.append(str(_ADDONS_DEFAULT_DIR))

    remove_broken_addon_links()
    if bpy.app.version >= (4, 2, 0):
        ensure_extension_repo_exists(EXTENSIONS_REPOSITORY)
        remove_broken_extension_links()

    for addon_info in addons_to_load:
        try:
            load_path = _link_addon_or_extension(addon_info)
        except PermissionError as e:
            LOG.error(
                f"""ERROR: {e} 
Path "{e.filename}" can not be removed. **Please remove it manually!** Most likely causes:
    - Path requires admin permissions to remove
    - Windows only: You upgraded Blender version and imported old setting. Now links became real directories.
    - Path is a real directory with the same name as addon (removing might cause data loss!)"""
            )
            raise e
        else:
            path_mappings.append({"src": str(addon_info.load_dir), "load": str(load_path)})

    return path_mappings


def _link_addon_or_extension(addon_info: AddonInfo) -> Path:
    if is_addon_legacy(addon_info.load_dir):
        if is_in_any_addon_directory(addon_info.load_dir):
            # blender knows about addon and can load it
            load_path = addon_info.load_dir
        else:  # addon is in external dir or is in extensions dir
            _remove_duplicate_addon_links(addon_info)
            load_path = _ADDONS_DEFAULT_DIR / addon_info.module_name
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
            _remove_duplicate_extension_links(addon_info)
            _remove_duplicate_addon_links(addon_info)
            os.makedirs(_EXTENSIONS_DEFAULT_DIR, exist_ok=True)
            load_path = _EXTENSIONS_DEFAULT_DIR / addon_info.module_name
            create_link_in_user_addon_directory(addon_info.load_dir, load_path)
    return load_path


def _remove_duplicate_addon_links(addon_info: AddonInfo):
    existing_addon_with_the_same_target = does_addon_link_exist(addon_info.load_dir)
    while existing_addon_with_the_same_target:
        if existing_addon_with_the_same_target:
            LOG.info(f"Removing old link: {existing_addon_with_the_same_target}")
            os.remove(existing_addon_with_the_same_target)
        existing_addon_with_the_same_target = does_addon_link_exist(addon_info.load_dir)


def _remove_duplicate_extension_links(addon_info: AddonInfo):
    existing_extension_with_the_same_target = does_extension_link_exist(addon_info.load_dir)
    while existing_extension_with_the_same_target:
        if existing_extension_with_the_same_target:
            LOG.info(f"Removing old link: {existing_extension_with_the_same_target}")
            os.remove(existing_extension_with_the_same_target)
        existing_extension_with_the_same_target = does_extension_link_exist(addon_info.load_dir)


def _resolve_link_windows_cmd(path: Path) -> Optional[str]:
    IO_REPARSE_TAG_MOUNT_POINT = "0xa0000003"
    JUNCTION_INDICATOR = f"Reparse Tag Value : {IO_REPARSE_TAG_MOUNT_POINT}"
    try:
        output = subprocess.check_output(["fsutil", "reparsepoint", "query", str(path)])
    except subprocess.CalledProcessError:
        return None
    output_lines = output.decode().split(os.linesep)
    if not output_lines[0].startswith(JUNCTION_INDICATOR):
        return None
    TARGET_PATH_INDICATOR = "Print Name:            "
    for line in output_lines:
        if line.startswith(TARGET_PATH_INDICATOR):
            possible_target = line[len(TARGET_PATH_INDICATOR) :]
            if os.path.exists(possible_target):
                return possible_target


def _resolve_link(path: Path) -> Optional[str]:
    """Return target if is symlink or junction"""
    try:
        return os.readlink(str(path))
    except OSError as e:
        # OSError: [WinError 4390] The file or directory is not a reparse point
        if sys.platform == "win32":
            if e.winerror == 4390:
                return None
        else:
            # OSError: [Errno 22] Invalid argument: '/snap/blender/5088/4.2/extensions/system/readme.txt'
            if e.errno == 22:
                return None
        LOG.warning(f"can not resolve link target {e}")
        return None
    except ValueError as e:
        # there are major differences in python windows junction support (3.7.0 and 3.7.9 give different errors)
        if sys.platform == "win32":
            return _resolve_link_windows_cmd(path)
        else:
            LOG.warning(f"can not resolve link target {e}")
            return None


def does_addon_link_exist(development_directory: Path) -> Optional[Path]:
    """Search default addon path and return first path that links to `development_directory`"""
    for file in os.listdir(_ADDONS_DEFAULT_DIR):
        existing_addon_dir = Path(_ADDONS_DEFAULT_DIR, file)
        target = _resolve_link(existing_addon_dir)
        if target:
            windows_being_windows = target.lstrip(r"\\?")
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
        for file in os.listdir(repo_dir):
            existing_extension_dir = Path(repo_dir, file)
            target = _resolve_link(existing_extension_dir)
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
    LOG.debug(f'New extensions repository "{extensions_repository}" created')
    return bpy.context.preferences.extensions.repos.new(name=extensions_repository, module=extensions_repository)


def remove_broken_addon_links():
    for file in os.listdir(_ADDONS_DEFAULT_DIR):
        addon_dir = _ADDONS_DEFAULT_DIR / file
        if not addon_dir.is_dir():
            continue
        target = _resolve_link(addon_dir)
        if target and not os.path.exists(target):
            LOG.info(f"Removing invalid link: {addon_dir} -> {target}")
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
                LOG.info(f"Removing invalid link: {existing_extension_dir} -> {target}")
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
            addon_name = "bl_ext." + EXTENSIONS_REPOSITORY + "." + addon_info.module_name

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
