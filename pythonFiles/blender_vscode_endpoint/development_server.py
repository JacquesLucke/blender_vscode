import bpy
import json
import http
import time
import threading
import http.server
import socketserver
from .utils import get_random_port

active_development_port = None

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
        self.send_json("Hello World")

    def send_json(self, data):
        serialized_data = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(http.HTTPStatus.OK)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Lenght", str(len(serialized_data)))
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
