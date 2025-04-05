import re
import bpy
import runpy
from bpy.props import *
from ..utils import redraw_all
from ..communication import register_post_action
from .. import log

LOG = log.getLogger()


class RunScriptOperator(bpy.types.Operator):
    bl_idname = "dev.run_script"
    bl_label = "Run Script"

    filepath: StringProperty()

    def execute(self, context):
        ctx = prepare_script_context(self.filepath)
        LOG.info(f'Run script: "{self.filepath}"')
        LOG.debug(f"Run script context override: {ctx}")
        runpy.run_path(self.filepath, init_globals={"CTX": ctx})
        redraw_all()
        return {"FINISHED"}


def run_script_action(data):
    path = data["path"]
    context = prepare_script_context(path)

    if bpy.app.version < (4, 0, 0):
        bpy.ops.dev.run_script(context, filepath=path)
        return

    with bpy.context.temp_override(**context):
        bpy.ops.dev.run_script(filepath=path)


def prepare_script_context(filepath):
    with open(filepath) as fs:
        text = fs.read()

    area_type = "VIEW_3D"
    region_type = "WINDOW"

    for line in text.splitlines():
        match = re.match(r"^\s*#\s*context\.area\s*:\s*(\w+)", line, re.IGNORECASE)
        if match:
            area_type = match.group(1)

    context = {}
    context["window_manager"] = bpy.data.window_managers[0]
    context["window"] = context["window_manager"].windows[0]
    context["scene"] = context["window"].scene
    context["view_layer"] = context["window"].view_layer
    context["screen"] = context["window"].screen
    context["workspace"] = context["window"].workspace
    context["area"] = get_area_by_type(area_type)
    context["region"] = get_region_in_area(context["area"], region_type) if context["area"] else None
    return context


def get_area_by_type(area_type):
    for area in bpy.data.window_managers[0].windows[0].screen.areas:
        if area.type == area_type:
            return area
    return None


def get_region_in_area(area, region_type):
    for region in area.regions:
        if region.type == region_type:
            return region
    return None


def register():
    bpy.utils.register_class(RunScriptOperator)
    register_post_action("script", run_script_action)
