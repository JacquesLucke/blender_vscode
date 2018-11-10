import os
import sys
import bpy
import json
import requests
import threading

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
    from flask import Flask, jsonify
    SERVER_PORT = 7643

    def serverThreadFunction():
        app = Flask(__name__)
        @app.route("/", methods=['POST'])
        def handlePost(*args, **kwargs):
            return "OK"
        app.run(debug=True, port=SERVER_PORT, use_reloader=False)

    thread = threading.Thread(target=serverThreadFunction)
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
