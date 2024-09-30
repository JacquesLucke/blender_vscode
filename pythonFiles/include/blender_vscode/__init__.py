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
    installation.ensure_packages_are_installed(
        [
            "debugpy<=1.7.0",
            # debugpy 1.7.0 is last version that officially supports 3.7
            "requests<=2.29.0",  # blender 2.80 'ssl' module is compiled with 'OpenSSL 1.1.0h' what breaks with requests >2.29.0
            # requests is shipped with blender so it it should not be even installed
            "werkzeug<=2.2.3",
            # wergzeug 2.2.3 is last version that officially supports 3.7
            "flask<=2.2.5",  # keep flask version pinned until werkzeug and underlying multiprocessing issue is fixed: https://github.com/JacquesLucke/blender_vscode/issues/191
            # flask 2.2.5 is last version that officially supports 3.7
        ]
    )

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
