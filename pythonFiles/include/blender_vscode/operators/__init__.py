from . import addon_update
from . import script_runner
from . import new_operator
from . import new_panel

modules = (
    addon_update,
    script_runner,
    new_operator,
    new_panel,
)

def register():
    for module in modules:
        module.register()
