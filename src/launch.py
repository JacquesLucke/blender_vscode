import bpy
from pathlib import Path

source_dir = Path(__file__).parent
addons_dir = Path(bpy.utils.user_resource('SCRIPTS', "addons"))
print(source_dir)
print(addons_dir)
