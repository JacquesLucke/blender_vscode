import bpy
from bpy.props import *
from .. utils import get_prefixes
from .. communication import send_dict_as_json

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


def register():
    bpy.utils.register_class(NewPanelOperator)
