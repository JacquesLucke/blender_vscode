import atexit
import os
import sys
import traceback
from pathlib import Path
from typing import List, Tuple, Union, Optional, Dict

import bpy

from . import AddonInfo
from .communication import send_dict_as_json
from .environment import addon_directories, KEEP_ADDON_INSTALLED
from .utils import is_addon_legacy, addon_has_bl_info


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

    addons_default_dir = bpy.utils.user_resource("SCRIPTS", path="addons")
    # always make sure addons are in path, important when running fresh blender install
    # do it always to avoid very confusing logic in the loop below
    os.makedirs(addons_default_dir, exist_ok=True)
    if str(addons_default_dir) not in sys.path:
        sys.path.append(str(addons_default_dir))

    load_status: List[Dict] = []
    # disable bpy.ops.preferences.copy_prev() is not happy with links that are about to be crated
    bpy.types.PREFERENCES_OT_copy_prev.poll = _fake_poll

    if sys.platform == "win32":
        disable_addon_uninstallation()

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
                    # blender does not know about extension, and it must be linked to default location
                    extensions_default_dir = Path(bpy.utils.user_resource("EXTENSIONS", path="user_default"))
                    os.makedirs(extensions_default_dir, exist_ok=True)
                    load_path = os.path.join(extensions_default_dir, addon_info.module_name)
                    make_temporary_link(addon_info.load_dir, load_path)
            path_mappings.append({"src": str(addon_info.load_dir), "load": str(load_path)})
        except Exception:
            traceback.print_exc()
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
