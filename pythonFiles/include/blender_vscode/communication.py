import logging
import random
import threading
import time
from functools import partial
from typing import Callable, Dict

import debugpy
import flask
import requests

from .environment import LOG_FLASK, blender_path, scripts_folder, python_path
from .utils import run_in_main_thread
from . import log

LOG = log.getLogger()

EDITOR_ADDRESS = None
OWN_SERVER_PORT = None
DEBUGPY_PORT = None

SERVER = flask.Flask("Blender Server")
SERVER.logger.setLevel(logging.DEBUG if LOG_FLASK else logging.ERROR)
POST_HANDLERS = {}


def setup(address: str, path_mappings):
    global EDITOR_ADDRESS, OWN_SERVER_PORT, DEBUGPY_PORT
    EDITOR_ADDRESS = address

    OWN_SERVER_PORT = start_own_server()
    DEBUGPY_PORT = start_debug_server()

    send_connection_information(path_mappings)

    LOG.info("Waiting for debug client.")
    debugpy.wait_for_client()
    LOG.info("Debug client attached.")


def start_own_server():
    port = [None]

    def server_thread_function():
        while True:
            try:
                port[0] = get_random_port()
                SERVER.run(debug=True, port=port[0], use_reloader=False)
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
            # for < 2.92 support (debugpy has problems when using bpy.app.binary_path_python)
            # https://github.com/microsoft/debugpy/issues/1330
            debugpy.configure(python=str(python_path))
            debugpy.listen(("localhost", port))
            break
        except OSError:
            pass
    return port


# Server
#########################################


@SERVER.route("/", methods=["POST"])
def handle_post():
    data = flask.request.get_json()
    LOG.debug(f"Got POST: {data}")

    if data["type"] in POST_HANDLERS:
        return POST_HANDLERS[data["type"]](data)
    else:
        LOG.warning(f"Unhandled POST: {data}")

    return "OK"


@SERVER.route("/", methods=["GET"])
def handle_get():
    data = flask.request.get_json()
    LOG.debug(f"Got GET: {str(data)}")

    if data["type"] == "ping":
        pass
    elif data["type"] == "complete":
        from .blender_complete import complete

        return {"items": complete(data)}
    else:
        LOG.warning(f"Unhandled GET: {data}")
    return "OK"


def register_post_handler(type: str, handler: Callable):
    assert type not in POST_HANDLERS, POST_HANDLERS
    POST_HANDLERS[type] = handler


def register_post_action(type: str, handler: Callable):
    def request_handler_wrapper(data):
        run_in_main_thread(partial(handler, data))
        return "OK"

    register_post_handler(type, request_handler_wrapper)


# Sending Data
###############################


def send_connection_information(path_mappings: Dict):
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
    LOG.debug(f"Sending: {data}")
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
