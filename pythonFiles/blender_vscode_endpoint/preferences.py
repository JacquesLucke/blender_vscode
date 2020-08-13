import bpy
from bpy.props import *
from . package_installation import is_pip_installed

class MyPreferences(bpy.types.AddonPreferences):
    bl_idname = __package__

    package_name_to_install: StringProperty("Package Name to Install")

    def draw(self, context):
        layout: bpy.types.UILayout = self.layout
        if not is_pip_installed():
            layout.operator("development.install_pip")

        layout = layout.column()
        layout.active = is_pip_installed()
        row = layout.row(align=True)
        row.prop(self, "package_name_to_install", text="Install Package")
        props = row.operator("development.install_python_package", text="", icon='IMPORT')
        props.package_name = self.package_name_to_install
