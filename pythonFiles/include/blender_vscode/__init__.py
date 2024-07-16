import sys
from dataclasses import dataclass
from pathlib import Path

import bpy


@dataclass
class AddonInfo:
    load_dir: Path
    module_name: str


def startup(editor_address, addons_to_load: list[AddonInfo], allow_modify_external_python):
    if bpy.app.version < (2, 80, 34):
        handle_fatal_error("Please use a newer version of Blender")

    from . import installation

    installation.ensure_packages_are_installed(["debugpy", "flask", "requests"], allow_modify_external_python)

    from . import load_addons

    path_mappings = load_addons.setup_addon_links(addons_to_load)

    from . import communication

    communication.setup(editor_address, path_mappings)

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
