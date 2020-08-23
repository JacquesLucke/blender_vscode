import bpy
import sys
import traceback
import addon_utils
from bpy.props import *
from .utils import redraw_all
from . import dev_server

class ReloadAddonOperator(bpy.types.Operator):
    bl_idname = "development.reload_addon"
    bl_label = "Reload Addon"

    module_name: StringProperty()

    def execute(self, context):
        try:
            addon_utils.disable(self.module_name, default_set=False)
        except:
            traceback.print_exc()
            self.report({'ERROR'}, "Could not disable the addon, check the terminal")
            return {'CANCELLED'}

        for name in list(sys.modules.keys()):
            if name == self.module_name or name.startswith(self.module_name + "."):
                del sys.modules[name]

        try:
            addon_utils.enable(self.module_name, default_set=True, persistent=True)
        except:
            traceback.print_exc()
            self.report({'ERROR'}, "Could not disable the addon, check the terminal")
            return {'CANCELLED'}

        redraw_all()
        return {'FINISHED'}

@dev_server.request_command("reload_addon")
def reload_addon_command(args):
    module_name = args["module_name"]
    bpy.ops.development.reload_addon(module_name=module_name)
