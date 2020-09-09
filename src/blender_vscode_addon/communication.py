import bpy
import json
import http
import time
import requests
import threading
import functools
import http.server
import socketserver
from .utils import get_random_port
from .main_thread_execution import run_in_main_thread

# Handle Incoming Requests
##########################################

active_port = None
request_handlers = {}

class StartServerOperator(bpy.types.Operator):
    bl_idname = "development.start_server"
    bl_label = "Start Server"
    bl_description = ""

    def execute(self, context):
        if active_port is not None:
            self.report({'INFO'}, "development server is running already")
            return {'FINISHED'}

        ensure_server_is_running()
        return {'FINISHED'}

class MyRequestHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        content_bytes = self.rfile.read(content_length)
        content_str = content_bytes.decode('utf-8')
        try:
            content_json = json.loads(content_str) if content_length != 0 else None
        except json.JSONDecodeError:
            self.send_json(http.HTTPStatus.BAD_REQUEST, None)
            return

        request_path = self.path
        if request_path not in request_handlers:
            self.send_json(http.HTTPStatus.BAD_REQUEST, None)
            return
        handler = request_handlers[request_path]
        response_data = handler(content_json)
        self.send_json(http.HTTPStatus.OK, response_data)

    def send_json(self, status, data):
        serialized_data = json.dumps(data, indent=2).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Lenght', str(len(serialized_data)))
        self.end_headers()
        self.wfile.write(serialized_data)

    def log_message(self, *args, **kwargs):
        # Don't log stuff to the terminal.
        pass

def ensure_server_is_running():
    global active_port
    if active_port is not None:
        return

    port = [None]

    def server_thread_function():
        while True:
            try:
                port[0] = get_random_port()
                with socketserver.TCPServer(("", port[0]), MyRequestHandler) as httpd:
                    httpd.serve_forever()
            except OSError:
                pass

    thread = threading.Thread(target=server_thread_function)
    thread.daemon = True
    thread.start()

    while port[0] is None:
        time.sleep(0.01)

    active_port = port[0]

def get_server_port():
    return active_port

def register_request_handler(request_path: str, request_function):
    assert request_path.startswith("/")
    request_handlers[request_path] = request_function

def register_request_command(request_path: str, request_command):
    def handler(args):
        run_in_main_thread(functools.partial(request_command, args))
        return "command scheduled"
    register_request_handler(request_path, handler)

def request_handler(request_path: str):
    def decorator(func):
        register_request_handler(request_path, func)
        return func
    return decorator

def request_command(request_path: str):
    def decorator(func):
        register_request_command(request_path, func)
        return func
    return decorator

@request_command("/quit")
def quit_command(args):
    bpy.ops.wm.quit_blender()


# Handle Outgoing Requests
#####################################

vscode_address = None

def set_vscode_address(address: str):
    global vscode_address
    vscode_address = address

def get_vscode_address():
    return vscode_address

def send_command(request_path: str, json_arg=None):
    if vscode_address is None:
        return
    request_path.startswith("/")
    requests.post(f"http://{vscode_address}{request_path}", data=json.dumps(json_arg))

@request_command("/set_vscode_address")
def set_vscode_address_command(arg):
    set_vscode_address(arg)