import bpy
import sys
import traceback
import addon_utils
from bpy.props import *
from .. utils import redraw_all
from .. communication import send_dict_as_json, register_post_action

class UpdateAddonOperator(bpy.types.Operator):
    bl_idname = "dev.update_addon"
    bl_label = "Update Addon"

    module_name: StringProperty()

    def execute(self, context):
        try:
            addon_utils.disable(self.module_name, default_set=False)
        except:
            traceback.print_exc()
            send_dict_as_json({"type" : "disableFailure"})
            return {'CANCELLED'}

        for name in list(sys.modules.keys()):
            if name.startswith(self.module_name):
                del sys.modules[name]

        try:
            addon_utils.enable(self.module_name, default_set=True, persistent=True)
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
