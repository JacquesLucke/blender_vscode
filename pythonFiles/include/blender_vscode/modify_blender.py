import os
from pathlib import Path
from typing import Union

import bpy

from .utils_files import resolve_link


def _fake_poll(*args, **kwargs):
    return False


def _add_warning_label(layout: bpy.types.UILayout, path: Union[str, os.PathLike], message: str):
    layout.label(text=message, icon="ERROR")
    if path and bpy.app.version >= (3, 6, 0):  # most likely https://projects.blender.org/blender/blender/pulls/104531
        layout.operator("file.external_operation", text="Open in explorer", icon="FILEBROWSER").filepath = str(path)
    layout.operator("dev.copy_text", text="Copy addon path", icon="COPYDOWN").text = str(path)


def _path_from_addon(module: str):
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


def disable_addon_remove():
    """
    On windows may lead to data loss as blender is treating junctions as directories.

    Soft link are handled correctly since [blender 2.8](https://developer.blender.org/rBe6ba760ce8fda5cf2e18bf26dddeeabdb4021066)
    """
    old_draw = bpy.types.PREFERENCES_OT_addon_remove.draw

    def conditional_addon_remove_draw(self: "bpy.types.PREFERENCES_OT_addon_remove", context: "bpy.types.Context"):
        nonlocal old_draw
        path, isdir = _path_from_addon(self.module)
        if isdir and resolve_link(path):
            _add_warning_label(
                layout=self.layout,
                path=Path(path).parent,
                message="This addon is a link. Uninstalling might cause data loss. Remove it manually",
            )
            return
        return old_draw(self, context)

    bpy.types.PREFERENCES_OT_addon_remove.draw = conditional_addon_remove_draw
    bpy.types.PREFERENCES_OT_addon_remove.execute = lambda _self, _context: {"FINISHED"}
    bpy.types.PREFERENCES_OT_addon_remove.invoke = lambda self, context, _event: context.window_manager.invoke_popup(
        self, width=400
    )


def disable_copy_settings_from_previous_version():
    """
    Disables operator: bpy.ops.preferences.copy_prev()

    This operator copies windows junctions as normal directories which need to be removed manually by user.
    """
    bpy.types.PREFERENCES_OT_copy_prev.poll = _fake_poll
