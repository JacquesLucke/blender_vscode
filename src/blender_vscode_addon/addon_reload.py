import bpy
import sys
import traceback
import addon_utils
from bpy.props import *
from .utils import redraw_all
from . import communication

class ReloadAddonOperator(bpy.types.Operator):
    bl_idname = "development.reload_addon"
    bl_label = "Reload Addon"

    module_name: StringProperty()

    def execute(self, context):
        try:
            reload_addon(self.module_name)
        except e:
            self.report({'ERROR'}, str(e))
            return {'CANCELLED'}
        redraw_all()
        return {'FINISHED'}

def reload_addon(module_name: str):
    try:
        module = __import__(module_name)
    except:
        traceback.print_exc()
        raise Exception(f"Cannot import module {module_name}")

    if getattr(module, "__addon_enabled__", False):
        try:
            addon_utils.disable(module_name, default_set=False)
        except:
            traceback.print_exc()
            raise Exception("Could not disable the addon, check the terminal")

    for name in list(sys.modules.keys()):
        if name == module_name or name.startswith(module_name + "."):
            del sys.modules[name]

    try:
        addon_utils.enable(module_name, default_set=True, persistent=True)
    except:
        traceback.print_exc()
        raise Exception("Could not enable the addon, check the terminal")

@communication.request_command("/reload_addons")
def reload_addon_command(addon_names):
    addon_names = set(addon_names)
    module_names = []
    for addon in bpy.context.preferences.addons:
        module_name = addon.module
        module = __import__(module_name)
        addon_name = module.bl_info["name"]
        if addon_name in addon_names:
            module_names.append(module_name)

    for module_name in module_names:
        bpy.ops.development.reload_addon(module_name=module_name)
