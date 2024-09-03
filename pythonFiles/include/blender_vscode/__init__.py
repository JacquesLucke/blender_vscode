import logging

# todo remove: this applies colors to all loggers, not only this addon. But I like colors...
logging.addLevelName(logging.DEBUG, "\033[1;37m%s\033[1;0m" % logging.getLevelName(logging.DEBUG))
logging.addLevelName(logging.INFO, "\033[1;32m%s\033[1;0m" % logging.getLevelName(logging.INFO))
logging.addLevelName(logging.WARNING, "\033[1;31m%s\033[1;0m" % logging.getLevelName(logging.WARNING))
logging.addLevelName(logging.ERROR, "\033[1;41m%s\033[1;0m" % logging.getLevelName(logging.ERROR))
logging.basicConfig(format="%(levelname)s:%(name)s: %(message)s", level=logging.DEBUG)
logging.getLogger().setLevel(logging.DEBUG)

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List

import bpy


@dataclass
class AddonInfo:
    load_dir: Path
    module_name: str


def startup(editor_address, addons_to_load: List[AddonInfo]):
    if bpy.app.version < (2, 80, 34):
        handle_fatal_error("Please use a newer version of Blender")

    from . import installation

    # blender 2.80 'ssl' module is compiled with 'OpenSSL 1.1.0h' what breaks with requests >2.29.0
    installation.ensure_packages_are_installed(["debugpy", "requests<=2.29.0", "flask", "jedi"])

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
