import logging
import random
import threading
import time
from functools import partial
from typing import Callable, Dict

import debugpy
import flask
import requests
from werkzeug.serving import make_server

from . import log
from .environment import (LOG_FLASK, VSCODE_IDENTIFIER, blender_path,
                          python_path, scripts_folder)
from .utils import run_in_main_thread

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
    server_started = threading.Event()
    startup_failed = threading.Event()
    result = {"port": None, "exception": None}

    def server_thread_function():
        for _attempt in range(10):
            port = get_random_port()
            try:
                httpd = make_server("127.0.0.1", port, SERVER)

                # Startup was successful — signal and continue
                result["port"] = port
                server_started.set()

                # Blocks here. If it fails the error remains unhandled.
                httpd.serve_forever()
                return
            except OSError as e:
                # retry on port conflicts, etc
                LOG.info(f"Port {port} failed with OSError, retrying... ({e})")
                continue
            except Exception as e:
                LOG.error(f"Unexpected error starting server on port {port}: {e}")
                result["exception"] = e
                startup_failed.set()
                return
        # If loop exhausted without success and without unexpected exception
        LOG.exception("Failed to start server after 10 attempts.")
        startup_failed.set()

    thread = threading.Thread(target=server_thread_function, daemon=True)
    thread.start()

    timeout = 15  # seconds
    deadline = time.time() + timeout
    # Wait for either success or failure
    while time.time() < deadline:
        if server_started.is_set():
            LOG.debug(f"Flask server started on port {result['port']}")
            return result["port"]
        if startup_failed.is_set():
            raise RuntimeError("Failed to start Flask server. See logs for details.") from result["exception"]
        time.sleep(0.07)
    raise TimeoutError(f"Falsk server did not start within {timeout} seconds.")


def start_debug_server():
    # retry on port conflicts, todo catch only specific exceptions
    # note debugpy changed exception types between versions, todo investigate
    last_exception = None
    for _attempt in range(15):
        port = get_random_port()
        last_exception = None
        try:
            # for < 2.92 support (debugpy has problems when using bpy.app.binary_path_python)
            # https://github.com/microsoft/debugpy/issues/1330
            debugpy.configure(python=str(python_path))
            debugpy.listen(("localhost", port))
            return port
        except Exception as e:
            LOG.warning(f"Debugpy failed to start on port {port}: {e}")
            last_exception = e
    raise RuntimeError(f"Failed to start debugpy after 15 attempts.") from last_exception


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


@SERVER.route("/ping", methods=["GET"])
def handle_get_ping():
    LOG.debug(f"Got ping")
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
            "vscodeIdentifier": VSCODE_IDENTIFIER,
        }
    )


def send_dict_as_json(data):
    LOG.debug(f"Sending: {data}")
    requests.post(EDITOR_ADDRESS, json=data)


# Utils
###############################


def get_random_port():
    return random.randint(49152, 65535)


def get_blender_port():
    return OWN_SERVER_PORT


def get_debugpy_port():
    return DEBUGPY_PORT


def get_editor_address():
    return EDITOR_ADDRESS
