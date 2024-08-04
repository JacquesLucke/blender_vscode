import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import List

import bpy


@dataclass
class AddonInfo:
    load_dir: Path
    module_name: str


def startup(editor_address, addons_to_load: List[AddonInfo], allow_modify_external_python):
    if bpy.app.version < (2, 80, 34):
        handle_fatal_error("Please use a newer version of Blender")

    from . import installation

    installation.ensure_packages_are_installed(["debugpy", "flask", "requests"], allow_modify_external_python)

    from . import communication

    communication.setupFlaskServer(editor_address)

    from .vs_code_settings import handle_setting_change, EXTENSIONS_REPOSITORY

    communication.register_post_handler("setting", handle_setting_change)
    _extensions_repository = communication.send_get_setting("addon.extensionsRepository")

    while EXTENSIONS_REPOSITORY is None:
        from .vs_code_settings import EXTENSIONS_REPOSITORY
        time.sleep(0.05)
        print("Waiting for settings...")

    from . import load_addons

    path_mappings = load_addons.setup_addon_links(addons_to_load)

    communication.setupDebugpyServer(path_mappings)

    from . import operators, ui

    ui.register()
    operators.register()

    load_addons.load(addons_to_load)


def handle_fatal_error(message):
    print()
    print("#" * 80)
    for line in message.splitlines():
        print(">  ", line)
    print("#" * 80)
    print()
    sys.exit(1)
