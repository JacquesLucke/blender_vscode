import logging
import os
import sys
import json
import traceback
from pathlib import Path
from typing import TYPE_CHECKING

include_dir = Path(__file__).parent / "include"
sys.path.append(str(include_dir))

# Get proper type hinting without impacting runtime
if TYPE_CHECKING:
    from .include import blender_vscode
else:
    import blender_vscode

LOG = blender_vscode.log.getLogger()
LOG.info(f"ADDONS_TO_LOAD {json.loads(os.environ['ADDONS_TO_LOAD'])}")

try:
    addons_to_load = []
    for info in json.loads(os.environ["ADDONS_TO_LOAD"]):
        addon_info = blender_vscode.AddonInfo(**info)
        addon_info.load_dir = Path(addon_info.load_dir)
        addons_to_load.append(addon_info)

    blender_vscode.startup(
        editor_address=f"http://localhost:{os.environ['EDITOR_PORT']}",
        addons_to_load=addons_to_load,
    )
except Exception as e:
    if type(e) is not SystemExit:
        traceback.print_exc()
        sys.exit()
