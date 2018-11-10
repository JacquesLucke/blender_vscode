import os
import sys
import bpy
import json
import requests
import threading

from bpy.props import StringProperty

debuggerPort = os.environ["DEBUGGER_PORT"]
debuggerUrl = f"http://localhost:{debuggerPort}"

try:
    import flask
    import ptvsd
except:
    pass

if "ptvsd" in globals():
    port = 5123
    ptvsd.enable_attach(("localhost", port))

    requests.post(debuggerUrl, json.dumps({"type" : "WAIT_FOR_ATTACH", "port" : port}))
    print("Waiting for Debugger")
    ptvsd.wait_for_attach()
    print("Debugger Attached")

if "flask" in globals():
    import flask
    from flask import Flask, jsonify
    SERVER_PORT = 7643

    def server_thread_function():
        app = Flask(__name__)
        @app.route("/", methods=['POST'])
        def handle_post():
            data = flask.request.get_json()
            if data["type"] == "UPDATE_ADDON":
                bpy.ops.dev.update_addon(module_name=addon_folder_name)
            return "OK"
        app.run(debug=True, port=SERVER_PORT, use_reloader=False)

    thread = threading.Thread(target=server_thread_function)
    thread.daemon = True
    thread.start()
    requests.post(debuggerUrl, json.dumps({"type" : "SET_PORT", "port" : SERVER_PORT}))

addon_directory = bpy.utils.user_resource('SCRIPTS', "addons")
external_addon_directory = os.environ['ADDON_DEV_DIR']

addon_folder_name = os.path.basename(external_addon_directory)
symlink_path = os.path.join(addon_directory, addon_folder_name)

if not os.path.exists(addon_directory):
    os.makedirs(addon_directory)
if os.path.exists(symlink_path):
    os.remove(symlink_path)

os.symlink(external_addon_directory, symlink_path, target_is_directory=True)

bpy.ops.wm.addon_enable(module=addon_folder_name)


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

bpy.utils.register_class(UpdateAddonOperator)