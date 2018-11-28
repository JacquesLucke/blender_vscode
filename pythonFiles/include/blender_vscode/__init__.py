import bpy
import sys

def startup(editor_address, addon_paths, allow_modify_external_python):
    if bpy.app.version < (2, 80, 34):
        handle_too_old_version()

    from . import installation
    installation.ensure_packages_are_installed(
        ["ptvsd", "flask", "requests"],
        allow_modify_external_python)

    from . import load_addons
    path_mappings = load_addons.setup_addon_links(addon_paths)

    from . import communication
    communication.setup(editor_address, path_mappings)

    load_addons.load(addon_paths)

    from . import ui
    from . import operators

    ui.register()
    operators.register()

def handle_too_old_version():
    print()
    print("#############################################")
    print(">   Please use a newer version of Blender   <")
    print("#############################################")
    print()
    sys.exit()
