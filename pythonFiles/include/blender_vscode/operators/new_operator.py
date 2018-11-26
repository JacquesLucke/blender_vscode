import bpy
from bpy.props import *
from .. communication import send_dict_as_json

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

def register():
    bpy.utils.register_class(NewOperatorOperator)
