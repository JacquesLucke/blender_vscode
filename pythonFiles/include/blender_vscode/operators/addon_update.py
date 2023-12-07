import bpy
import sys
import traceback
from bpy.props import *
from .. utils import redraw_all
from .. communication import send_dict_as_json, register_post_action

class UpdateAddonOperator(bpy.types.Operator):
    bl_idname = "dev.update_addon"
    bl_label = "Update Addon"

    module_name: StringProperty()

    def execute(self, context):
        try:
            bpy.ops.preferences.addon_disable(module=self.module_name)
        except:
            traceback.print_exc()
            send_dict_as_json({"type" : "disableFailure"})
            return {'CANCELLED'}

        root = None
        for (name, module) in sys.modules.copy().items():
            if not hasattr(module, '__file__'):
                continue

            if name == self.module_name and hasattr(module, '__path__'):
                root = module.__path__[0] + '\\'

            if root is not None and module.__file__.startswith(root):
                del sys.modules[name]

        try:
            bpy.ops.preferences.addon_enable(module=self.module_name)
        except:
            traceback.print_exc()
            send_dict_as_json({"type" : "enableFailure"})
            return {'CANCELLED'}

        send_dict_as_json({"type" : "addonUpdated"})

        redraw_all()
        return {'FINISHED'}

def reload_addon_action(data):
    for name in data["names"]:
        bpy.ops.dev.update_addon(module_name=name)

def register():
    bpy.utils.register_class(UpdateAddonOperator)
    register_post_action("reload", reload_addon_action)
