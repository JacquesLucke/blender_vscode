import functools
import re
import bpy
import runpy
from bpy.props import *
from .. utils import redraw_all
from .. communication import register_post_action


def run_script(path):
    context = prepare_script_context(path)
    runpy.run_path(path, init_globals={"CTX": context})
    redraw_all()


def run_script_action(data):
    path = data["path"]
    func = functools.partial(run_script, path)
    bpy.app.timers.register(func, first_interval=0.5)


def prepare_script_context(filepath):
    with open(filepath) as fs:
        text = fs.read()

    area_type = 'VIEW_3D'
    region_type = 'WINDOW'

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
    context["active_object"] = context["view_layer"].objects.active
    context["object"] = context["active_object"]
    context["collection"] = context["view_layer"].active_layer_collection.collection
    context["area"] = get_area_by_type(area_type)
    context["space_data"] = context["area"].spaces.active
    context["selected_objects"] = [obj for obj in context["view_layer"].objects if obj.select_get(view_layer=context["view_layer"])]
    context["selected_editable_objects"] = context["selected_objects"]
    context["region"] = get_region_in_area(context["area"], region_type) if context["area"] else None
    if context["space_data"].type == "VIEW_3D":
        context["region_data"] = context["space_data"].region_3d
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
    register_post_action("script", run_script_action)
