from . import addon_update
from . import script_runner
from . import stop_blender
from . import copy_string

modules = (addon_update, script_runner, stop_blender, copy_string)


def register():
    for module in modules:
        module.register()
