import os
import sys
import json
from pathlib import Path

include_dir = Path(__file__).parent / "include"
sys.path.append(str(include_dir))

import blender_vscode

blender_vscode.startup(
    editor_address=f"http://localhost:{os.environ['EDITOR_PORT']}",
    addon_paths=json.loads(os.environ['ADDON_DIRECTORIES_TO_LOAD']),
    allow_modify_external_python=os.environ['ALLOW_MODIFY_EXTERNAL_PYTHON'] == "yes",
)
