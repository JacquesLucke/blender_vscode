from . import addon_update
from . import script_runner

modules = (
    addon_update,
    script_runner,
)

def register():
    for module in modules:
        module.register()
