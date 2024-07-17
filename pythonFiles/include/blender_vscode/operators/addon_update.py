from pathlib import Path
import bpy
import sys
import traceback
from bpy.props import *
from ..utils import is_addon_legacy, redraw_all
from ..communication import send_dict_as_json, register_post_action


class UpdateAddonOperator(bpy.types.Operator):
    bl_idname = "dev.update_addon"
    bl_label = "Update Addon"

    module_name: StringProperty()

    def execute(self, context):
        try:
            bpy.ops.preferences.addon_disable(module=self.module_name)
        except Exception:
            traceback.print_exc()
            send_dict_as_json({"type": "disableFailure"})
            return {"CANCELLED"}

        for name in list(sys.modules.keys()):
            if name.startswith(self.module_name):
                del sys.modules[name]

        try:
            bpy.ops.preferences.addon_enable(module=self.module_name)
        except Exception:
            traceback.print_exc()
            send_dict_as_json({"type": "enableFailure"})
            return {"CANCELLED"}

        send_dict_as_json({"type": "addonUpdated"})

        redraw_all()
        return {"FINISHED"}


def reload_addon_action(data):
    module_names = []
    for name, dir in zip(data["names"], data["dirs"]):
        if is_addon_legacy(Path(dir)):
            module_names.append(name)
        else:
            module_names.append("bl_ext.user_default." + name)

    for name in module_names:
        bpy.ops.dev.update_addon(module_name=name)


def register():
    bpy.utils.register_class(UpdateAddonOperator)
    register_post_action("reload", reload_addon_action)
