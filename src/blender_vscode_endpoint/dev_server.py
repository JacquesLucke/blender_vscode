import bpy
import json
import http
import time
import threading
import functools
import http.server
import socketserver
from .utils import get_random_port
from .main_thread_execution import run_in_main_thread

active_development_port = None
request_handlers = {}

class StartDevelopmentServerOperator(bpy.types.Operator):
    bl_idname = "development.start_development_server"
    bl_label = "Start Development Server"
    bl_description = ""

    def execute(self, context):
        global active_development_port
        if active_development_port is not None:
            self.report({'INFO'}, "development server is running already")
            return {'FINISHED'}

        active_development_port = start_development_server()
        return {'FINISHED'}

class MyRequestHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        request_bytes = self.rfile.read(content_length)
        request_data = json.loads(request_bytes.decode('utf-8'))
        request_name = request_data['request_name']
        request_callback = request_handlers[request_name]
        request_callback_arg = request_data['request_arg']
        response_data = request_callback(request_callback_arg)
        self.send_json(response_data)

    def send_json(self, data):
        serialized_data = json.dumps(data, indent=2).encode('utf-8')
        self.send_response(http.HTTPStatus.OK)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Lenght', str(len(serialized_data)))
        self.end_headers()
        self.wfile.write(serialized_data)

    def log_message(self, *args, **kwargs):
        # Don't log stuff to the terminal.
        pass

def start_development_server():
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

    return port[0]

def get_active_development_port():
    return active_development_port

def register_request_handler(request_name: str, request_function):
    request_handlers[request_name] = request_function

def register_request_command(request_name: str, request_command):
    def handler(args):
        run_in_main_thread(functools.partial(request_command, args))
        return "command scheduled"
    register_request_handler(request_name, handler)

def request_handler(request_name: str):
    def decorator(func):
        register_request_handler(request_name, func)
        return func

def request_command(request_name: str):
    def decorator(func):
        register_request_command(request_name, func)
        return func

@request_command("quit")
def quit_command(args):
    bpy.ops.wm.quit_blender()
