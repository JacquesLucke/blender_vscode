import bpy
import sys
import runpy
import traceback
from bpy.props import *
from . utils import redraw_all
from . communication import send_dict_as_json, register_post_action

class UpdateAddonOperator(bpy.types.Operator):
    bl_idname = "dev.update_addon"
    bl_label = "Update Addon"

    module_name: StringProperty()

    def execute(self, context):
        try:
            bpy.ops.wm.addon_disable(module=self.module_name)
        except:
            traceback.print_exc()
            send_dict_as_json({"type" : "disableFailure"})
            return {'CANCELLED'}

        for name in list(sys.modules.keys()):
            if name.startswith(self.module_name):
                del sys.modules[name]

        try:
            bpy.ops.wm.addon_enable(module=self.module_name)
        except:
            traceback.print_exc()
            send_dict_as_json({"type" : "enableFailure"})
            return {'CANCELLED'}

        send_dict_as_json({"type" : "addonUpdated"})

        redraw_all()
        return {'FINISHED'}

class RunScriptOperator(bpy.types.Operator):
    bl_idname = "dev.run_script"
    bl_label = "Run Script"

    filepath: StringProperty()

    def execute(self, context):
        runpy.run_path(self.filepath)
        redraw_all()
        return {'FINISHED'}

class NewOperatorOperator(bpy.types.Operator):
    bl_idname = "dev.new_operator"
    bl_label = "New Operator"

    group_items = [(name, name, "") for name in dir(bpy.ops)]

    name: StringProperty(name="Name")
    group: EnumProperty(name="group", default="object", items=group_items)

    def invoke(self, context, event):
        return context.window_manager.invoke_props_dialog(self)

    def draw(self, context):
        layout = self.layout
        layout.prop(self, "name")
        layout.prop(self, "group")

    def execute(self, context):
        send_dict_as_json({
            "type" : "insertTemplate",
            "data" : {
                "type" : "newOperator",
                "name" : self.name,
                "group" : self.group,
            }
        })
        return {'FINISHED'}

class NewPanelOperator(bpy.types.Operator):
    bl_idname = "dev.new_panel"
    bl_label = "New Panel"

    def get_group_items(self, context):
        return [(group, group, "") for group in get_prefixes(dir(bpy.types), '_PT_')]

    name: StringProperty(name="Name")
    space_type: StringProperty(name="Space Type")
    region_type: StringProperty(name="Region Type")
    group : EnumProperty(name="Group", items=get_group_items)

    def invoke(self, context, event):
        self.space_type = context.space_data.type
        self.region_type = context.region.type
        return context.window_manager.invoke_props_dialog(self)

    def draw(self, context):
        layout = self.layout
        layout.prop(self, "name")
        layout.prop(self, "group")
        layout.prop(self, "space_type")
        layout.prop(self, "region_type")

    def execute(self, context):
        send_dict_as_json({
            "type" : "insertTemplate",
            "data" : {
                "type" : "newPanel",
                "name" : self.name,
                "spaceType" : self.space_type,
                "regionType" : self.region_type,
                "group" : self.group,
            }
        })
        return {'FINISHED'}


def reload_action(data):
    for name in data["names"]:
        bpy.ops.dev.update_addon(module_name=name)

def run_script_action(data):
    bpy.ops.dev.run_script(filepath=data["path"])


classes = (
    UpdateAddonOperator,
    RunScriptOperator,
    NewOperatorOperator,
    NewPanelOperator,
)

def register():
    register_post_action("reload", reload_action)
    register_post_action("script", run_script_action)

    for cls in classes:
        bpy.utils.register_class(cls)
