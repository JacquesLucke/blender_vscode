import os
import sys
import bpy
import json
import time
import random
import threading
import subprocess
from pprint import pprint

from bpy.props import (
    StringProperty,
    EnumProperty,
)


# Read Inputs
#########################################

external_port = os.environ["DEBUGGER_PORT"]
pip_path = os.environ["PIP_PATH"]
external_addon_directory = os.environ['ADDON_DEV_DIR']
process_identifier = os.environ['BLENDER_PROCESS_IDENTIFIER']

python_path = bpy.app.binary_path_python
external_url = f"http://localhost:{external_port}"


# Install Required Packages
##########################################

try: import pip
except ModuleNotFoundError:
    subprocess.run([python_path, pip_path])

def install_package(name):
    subprocess.run([python_path, "-m", "pip", "install", name])

def get_package(name):
    try: return __import__(name)
    except ModuleNotFoundError:
        install_package(name)
        return __import__(name)

ptvsd = get_package("ptvsd")
flask = get_package("flask")
requests = get_package("requests")


# Setup Communication
#########################################

def start_blender_server():
    from flask import Flask, jsonify

    port = [None]

    def server_thread_function():
        app = Flask("Blender Server")
        @app.route("/", methods=['POST'])
        def handle_post():
            data = flask.request.get_json()
            print("Got POST:", data)
            if data["type"] == "update":
                bpy.ops.dev.update_addon(module_name=addon_folder_name)
            return "OK"

        while True:
            try:
                port[0] = get_random_port()
                app.run(debug=True, port=port[0], use_reloader=False)
            except OSError:
                pass

    thread = threading.Thread(target=server_thread_function)
    thread.daemon = True
    thread.start()

    while port[0] is None:
        time.sleep(0.01)

    return port[0]

def start_debug_server():
    while True:
        port = get_random_port()
        try:
            ptvsd.enable_attach(("localhost", port))
            break
        except OSError:
            pass
    return port

def get_random_port():
    return random.randint(2000, 10000)

def send_connection_information(blender_port, debug_port):
    send_dict_as_json({
        "type" : "setup",
        "blenderPort" : blender_port,
        "debugPort" : debug_port,
        "identifier" : process_identifier,
    })

def send_dict_as_json(data):
    print("Sending:", data)
    requests.post(external_url, json=data)

blender_port = start_blender_server()
debug_port = start_debug_server()
send_connection_information(blender_port, debug_port)

print("Waiting for debug client.")
ptvsd.wait_for_attach()
print("Debug cliend attached.")


# Load Addon
########################################

addon_directory = bpy.utils.user_resource('SCRIPTS', "addons")
addon_folder_name = os.path.basename(external_addon_directory)
symlink_path = os.path.join(addon_directory, addon_folder_name)

if not os.path.exists(addon_directory):
    os.makedirs(addon_directory)
if os.path.exists(symlink_path):
    os.remove(symlink_path)

if sys.platform == "win32":
    import _winapi
    _winapi.CreateJunction(external_addon_directory, symlink_path)
else:
    os.symlink(external_addon_directory, symlink_path, target_is_directory=True)

bpy.ops.wm.addon_enable(module=addon_folder_name)


# Operators
########################################

class DevelopmentPanel(bpy.types.Panel):
    bl_idname = "DEV_PT_panel"
    bl_label = "Development"
    bl_space_type = 'PROPERTIES'
    bl_region_type = 'WINDOW'

    def draw(self, context):
        layout = self.layout
        layout.label(text=f"Debugger at Port {debug_port}")

class UpdateAddonOperator(bpy.types.Operator):
    bl_idname = "dev.update_addon"
    bl_label = "Update Addon"

    module_name: StringProperty()

    def execute(self, context):
        bpy.ops.wm.addon_disable(module=self.module_name)

        for name in list(sys.modules.keys()):
            if name.startswith(self.module_name):
                del sys.modules[name]

        bpy.ops.wm.addon_enable(module=self.module_name)

        self.redraw_all(context)
        return {'FINISHED'}

    def redraw_all(self, context):
        for window in context.window_manager.windows:
            for area in window.screen.areas:
                area.tag_redraw()

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
            "type" : "newOperator",
            "name" : self.name,
            "group" : self.group,
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
            "type" : "newPanel",
            "name" : self.name,
            "spaceType" : self.space_type,
            "regionType" : self.region_type,
            "group" : self.group,
        })
        return {'FINISHED'}

def get_prefixes(all_names, separator):
    return set(name.split(separator)[0] for name in all_names if separator in name)


# Register Classes
##############################################

classes = (
    DevelopmentPanel,
    UpdateAddonOperator,
    NewOperatorOperator,
    NewPanelOperator,
)

for cls in classes:
    bpy.utils.register_class(cls)