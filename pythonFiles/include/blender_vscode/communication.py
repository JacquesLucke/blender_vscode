import time
import flask
import debugpy
import random
import requests
import threading
from functools import partial
from .utils import run_in_main_thread
from .environment import blender_path, scripts_folder

EDITOR_ADDRESS = None
OWN_SERVER_PORT = None
DEBUGPY_PORT = None


def setup(address, path_mappings):
    global EDITOR_ADDRESS, OWN_SERVER_PORT, DEBUGPY_PORT
    EDITOR_ADDRESS = address

    OWN_SERVER_PORT = start_own_server()
    DEBUGPY_PORT = start_debug_server()

    send_connection_information(path_mappings)

    print("Waiting for debug client.")
    debugpy.wait_for_client()
    print("Debug client attached.")


def start_own_server():
    port = [None]

    def server_thread_function():
        while True:
            try:
                port[0] = get_random_port()
                server.run(debug=True, port=port[0], use_reloader=False)
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
            debugpy.listen(("localhost", port))
            break
        except OSError:
            pass
    return port


# Server
#########################################

server = flask.Flask("Blender Server")
post_handlers = {}


@server.route("/", methods=["POST"])
def handle_post():
    data = flask.request.get_json()
    print("Got POST:", data)

    if data["type"] in post_handlers:
        return post_handlers[data["type"]](data)

    return "OK"


@server.route("/", methods=["GET"])
def handle_get():
    flask.request
    data = flask.request.get_json()
    print("Got GET:", data)

    if data["type"] == "ping":
        pass
    return "OK"


def register_post_handler(type, handler):
    assert type not in post_handlers
    post_handlers[type] = handler


def register_post_action(type, handler):
    def request_handler_wrapper(data):
        run_in_main_thread(partial(handler, data))
        return "OK"

    register_post_handler(type, request_handler_wrapper)


# Sending Data
###############################


def send_connection_information(path_mappings):
    send_dict_as_json(
        {
            "type": "setup",
            "blenderPort": OWN_SERVER_PORT,
            "debugpyPort": DEBUGPY_PORT,
            "blenderPath": str(blender_path),
            "scriptsFolder": str(scripts_folder),
            "addonPathMappings": path_mappings,
        }
    )


def send_dict_as_json(data):
    print("Sending:", data)
    requests.post(EDITOR_ADDRESS, json=data)


# Utils
###############################


def get_random_port():
    return random.randint(2000, 10000)


def get_blender_port():
    return OWN_SERVER_PORT


def get_debugpy_port():
    return DEBUGPY_PORT


def get_editor_address():
    return EDITOR_ADDRESS
