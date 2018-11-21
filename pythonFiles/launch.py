import os
import sys
import bpy
import json
import time
import random
import typing
import textwrap
import traceback
import threading
import subprocess
from pathlib import Path
from pprint import pprint

from bpy.props import (
    StringProperty,
    EnumProperty,
)


# Read Inputs
#########################################

external_port = os.environ["EDITOR_PORT"]
pip_path = os.environ["PIP_PATH"]
addons_to_load = [Path(p) for p in json.loads(os.environ.get('ADDON_DIRECTORIES_TO_LOAD', []))]
allow_modify_external_python = os.environ.get('ALLOW_MODIFY_EXTERNAL_PYTHON', "") == "yes"

external_url = f"http://localhost:{external_port}"

python_path = Path(bpy.app.binary_path_python)
blender_path = Path(bpy.app.binary_path)
blender_directory = blender_path.parent
use_own_python = blender_directory in python_path.parents


# Install Required Packages
##########################################

required_packages = ["ptvsd", "flask", "requests"]

def install_packages(package_names):
    try: import pip
    except ModuleNotFoundError:
        subprocess.run([python_path, pip_path])

    for name in package_names:
        ensure_package_is_installed(name)

def ensure_package_is_installed(name):
    try: __import__(name)
    except ModuleNotFoundError:
        install_package(name)
        __import__(name)

def install_package(name):
    target = get_package_install_directory()
    subprocess.run([python_path, "-m", "pip", "install", name, '--target', target])

def get_package_install_directory():
    for path in sys.path:
        if "dist-packages" in path:
            return path
    raise Exception("Don't know where to install packages.")

try:
    for name in required_packages:
        __import__(name)
except ModuleNotFoundError:
    if not use_own_python and not allow_modify_external_python:
        raise Exception(textwrap.dedent(f'''\
            Installing packages in Python distributions, that don't
            come with Blender, is not allowed currently.
            Please enable 'blender.allowModifyExternalPython' in VS Code
            or make sure that those packages are installed by yourself:
            {required_packages}
        '''))
    install_packages(required_packages)


# Setup Communication
#########################################

import flask
import ptvsd
import requests

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
                for path in addons_to_load:
                    bpy.ops.dev.update_addon(module_name=path.name)
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
        "blenderPath" : str(blender_path),
        "scriptsFolder" : str(get_blender_scripts_folder()),
    })

def send_dict_as_json(data):
    print("Sending:", data)
    requests.post(external_url, json=data)

def get_blender_scripts_folder():
    version = bpy.app.version
    return blender_path.parent / f"{version[0]}.{version[1]}" / "scripts"

blender_port = start_blender_server()
debug_port = start_debug_server()
send_connection_information(blender_port, debug_port)

print("Waiting for debug client.")
ptvsd.wait_for_attach()
print("Debug cliend attached.")


# Load Addons
########################################

addon_directory = bpy.utils.user_resource('SCRIPTS', "addons")
if not os.path.exists(addon_directory):
    os.makedirs(addon_directory)

def create_link_in_addon_directory(directory):
    link_path = os.path.join(addon_directory, directory.name)

    if os.path.exists(link_path):
        os.remove(link_path)

    if sys.platform == "win32":
        import _winapi
        _winapi.CreateJunction(directory, link_path)
    else:
        os.symlink(directory, link_path, target_is_directory=True)

for addon_to_load in addons_to_load:
    create_link_in_addon_directory(addon_to_load)

    try:
        bpy.ops.wm.addon_enable(module=addon_to_load.name)
    except:
        traceback.print_exc()
        send_dict_as_json({"type" : "enableFailure", "addonPath" : str(addon_to_load)})


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