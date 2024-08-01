import bpy
from .communication import get_blender_port, get_debugpy_port, get_editor_address


class DevelopmentPanel(bpy.types.Panel):
    bl_idname = "DEV_PT_panel"
    bl_label = "Development"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Dev"

    def draw(self, context):
        layout = self.layout
        layout.label(text=f"Blender at Port {get_blender_port()}")
        layout.label(text=f"debugpy at Port {get_debugpy_port()}")
        layout.label(text=f"Editor at Address {get_editor_address()}")


classes = (DevelopmentPanel,)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)
