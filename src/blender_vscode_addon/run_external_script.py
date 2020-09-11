import re
import bpy
import runpy
from bpy.props import *
from .utils import redraw_all
from . import communication

class RunExternalScriptOperator(bpy.types.Operator):
    bl_idname = "development.run_external_script"
    bl_label = "Run External Script"
    bl_options = {'INTERNAL'}

    filepath: StringProperty()

    def execute(self, context):
        run_external_script(self.filepath)
        return {'FINISHED'}

class RunExternalScriptInternalOperator(bpy.types.Operator):
    bl_idname = "development.run_external_script_internal"
    bl_label = "Run External Script (internal)"
    bl_options = {'INTERNAL'}

    filepath: StringProperty()

    def execute(self, context):
        runpy.run_path(self.filepath)
        redraw_all()
        return {'FINISHED'}

@communication.request_command("/run_external_script")
def run_external_script(filepath):
    with open(filepath) as fs:
        script = fs.read()

    context_override = create_context_override_for_script(script)
    bpy.ops.development.run_external_script_internal(context_override, filepath=filepath)

def create_context_override_for_script(script):
    area_type = 'VIEW_3D'
    region_type = 'WINDOW'

    for line in script.splitlines():
        match = re.match(r"^\s*#\s*context\.area\s*:\s*(\w+)", line, re.IGNORECASE)
        if match:
            area_type = match.group(1)

    window = bpy.data.window_managers[0].windows[0]
    area = get_area_by_type(window.screen, area_type)
    region = None if area is None else get_region_by_type(area, region_type)

    context_override = {}
    context_override["window"] = window
    context_override["scene"] = window.scene
    context_override["screen"] = window.screen
    context_override["workspace"] = window.workspace
    if area is not None:
        context_override["area"] = area
        if region is not None:
            context_override["region"] = region
    return context_override

def get_area_by_type(screen, area_type):
    for area in screen.areas:
        if area.type == area_type:
            return area
    return None

def get_region_by_type(area, region_type):
    for region in area.regions:
        if region.type == region_type:
            return region
    return None
