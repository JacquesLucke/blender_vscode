import bpy
from bpy.props import *


class TextCopyOperator(bpy.types.Operator):
    bl_idname = "dev.copy_text"
    bl_label = "Copy text"

    text: StringProperty()

    def execute(self, context):
        context.window_manager.clipboard = self.text
        return {"FINISHED"}


def register():
    bpy.utils.register_class(TextCopyOperator)
