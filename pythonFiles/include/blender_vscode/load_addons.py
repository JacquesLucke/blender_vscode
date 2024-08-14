import atexit
import os
import subprocess
import sys
import traceback
from pathlib import Path
from typing import List, Tuple, Union, Optional, Dict

import bpy

from . import AddonInfo
from .communication import send_dict_as_json
from .environment import addon_directories, KEEP_ADDON_INSTALLED
from .utils import is_addon_legacy, addon_has_bl_info

if bpy.app.version >= (4, 2, 0):
    _EXTENSIONS_DEFAULT_DIR = Path(bpy.utils.user_resource("EXTENSIONS", path="user_default"))
else:
    _EXTENSIONS_DEFAULT_DIR = None
_ADDONS_DEFAULT_DIR = Path(bpy.utils.user_resource("SCRIPTS", path="addons"))


def _fake_poll(*args, **kwargs):
    return False


def add_warning_label(layout: bpy.types.UILayout, path: str):
    layout.label(text="You can not remove this repo when using VS Code on windows. If might cause data loss")
    print(path)
    if path:
        try:
            layout.operator("file.external_operation", text="Open in explorer", icon="FILEBROWSER").filepath = str(path)
        except AttributeError:
            pass
        layout.operator("dev.copy_text", text="Copy addon path", icon="COPYDOWN").text = str(path)


def path_from_addon(module):
    """Copied from bpy.types.PREFERENCES_OT_addon_remove.path_from_addon from Blender 4.2.
    Implementation in Blender 2.80 does not work correctly
    """
    import os
    import addon_utils

    for mod in addon_utils.modules():
        if mod.__name__ == module:
            filepath = mod.__file__
            if os.path.exists(filepath):
                if os.path.splitext(os.path.basename(filepath))[0] == "__init__":
                    return os.path.dirname(filepath), True
                else:
                    return filepath, False
    return None, False


def disable_addon_uninstallation():
    """
    On windows may lead to data loss as blender is treating junctions as directories.

    Soft link are handled correctly since [blender 2.8](https://developer.blender.org/rBe6ba760ce8fda5cf2e18bf26dddeeabdb4021066)
    """
    from pathlib import Path

    bpy.types.PREFERENCES_OT_addon_remove.draw = lambda self, _context: add_warning_label(
        self.layout, Path(path_from_addon(self.module)[0]).parent
    )
    bpy.types.PREFERENCES_OT_addon_remove.execute = lambda _self, _context: {"FINISHED"}
    bpy.types.PREFERENCES_OT_addon_remove.invoke = lambda self, context, _event: context.window_manager.invoke_popup(
        self, width=500
    )

    if bpy.app.version < (4, 2, 0):
        return
    bpy.types.USERPREF_MT_extensions_active_repo_remove.poll = _fake_poll

    old_draw = bpy.types.USERPREF_MT_extensions_active_repo_remove.draw

    def limited_remove_repo(self, context):
        nonlocal old_draw
        extensions = context.preferences.extensions
        active_repo_index = extensions.active_repo
        repo = extensions.repos[active_repo_index]
        if repo.module == "user_default":
            add_warning_label(
                self.layout, path=Path(repo.custom_directory if repo.use_custom_directory else repo.directory).parent
            )
            return
        else:
            return old_draw(self, context)

    bpy.types.USERPREF_MT_extensions_active_repo_remove.draw = limited_remove_repo


def setup_addon_links(addons_to_load: List[AddonInfo]) -> Tuple[List[Dict], List[Dict]]:
    path_mappings: List[Dict] = []

    # always make sure addons are in path, important when running fresh blender install
    # do it always to avoid very confusing logic in the loop below
    os.makedirs(_ADDONS_DEFAULT_DIR, exist_ok=True)
    if str(_ADDONS_DEFAULT_DIR) not in sys.path:
        sys.path.append(str(_ADDONS_DEFAULT_DIR))

    remove_broken_addon_links()
    if bpy.app.version >= (4, 2, 0):
        remove_broken_extension_links()

    load_status: List[Dict] = []
    # disable bpy.ops.preferences.copy_prev() is not happy with links that are about to be crated
    bpy.types.PREFERENCES_OT_copy_prev.poll = _fake_poll

    if sys.platform == "win32":
        disable_addon_uninstallation()

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
            # blender does not know about extension, and it must be linked to default location
            _remove_duplicate_extension_links(addon_info)
            os.makedirs(_EXTENSIONS_DEFAULT_DIR, exist_ok=True)
            load_path = _EXTENSIONS_DEFAULT_DIR / addon_info.module_name
            make_temporary_link(addon_info.load_dir, load_path)
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
    """Return target if is symlink or jucntion"""
    try:
        return os.readlink(str(path))
    except OSError as e:
        # OSError: [WinError 4390] The file or directory is not a reparse point
        if e.winerror == 4390:
            return None
        else:
            raise e
    except ValueError as e:
        # there are major differences in python windows junction support (3.7.0 and 3.7.9 give different errors)
        if sys.platform == "win32":
            return _resolve_link_windows_cmd(path)
        else:
            print("Warning: can not resolve link target", e)
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


def remove_broken_addon_links():
    for file in os.listdir(_ADDONS_DEFAULT_DIR):
        addon_dir = _ADDONS_DEFAULT_DIR / file
        if not addon_dir.is_dir():
            continue
        target = _resolve_link(addon_dir)
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
            target = _resolve_link(existing_extension_dir)
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
    if os.path.exists(link_path):
        try:
            os.remove(link_path)
        except PermissionError as ex:
            print(
                f'ERROR: Could not remove path "{link_path}" due to insufficient permission. Please remove it manually.'
            )
            raise ex

    if sys.platform == "win32":
        import _winapi

        _winapi.CreateJunction(str(directory), str(link_path))
    else:
        os.symlink(str(directory), str(link_path), target_is_directory=True)

    def cleanup():
        if KEEP_ADDON_INSTALLED:
            return
        if not os.path.exists(link_path):
            return
        try:
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
