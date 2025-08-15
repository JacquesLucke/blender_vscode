import sys
from pprint import pformat
from dataclasses import dataclass
from pathlib import Path
from typing import List

import bpy

from . import log

LOG = log.getLogger()


@dataclass
class AddonInfo:
    load_dir: Path
    module_name: str


def startup(editor_address, addons_to_load: List[AddonInfo]):
    if bpy.app.version < (2, 80, 34):
        handle_fatal_error("Please use a newer version of Blender")

    from . import installation

    # blender 2.80 'ssl' module is compiled with 'OpenSSL 1.1.0h' what breaks with requests >2.29.0
    installation.ensure_packages_are_installed(["debugpy", "requests<=2.29.0", "werkzeug<=3.0.3", "flask<=3.0.3"])

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
    print(f"PATHONPATH: {pformat(sys.path)}")
    print()
    sys.exit(1)
