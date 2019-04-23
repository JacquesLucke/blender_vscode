import os
import sys
import json
import traceback
from pathlib import Path

include_dir = Path(__file__).parent / "include"
sys.path.append(str(include_dir))

import blender_vscode
print(json.loads(os.environ['ADDONS_TO_LOAD']))

try:
    blender_vscode.startup(
        editor_address=f"http://localhost:{os.environ['EDITOR_PORT']}",
        addons_to_load=tuple(map(lambda x: (Path(x["load_dir"]), x["module_name"]),
                                 json.loads(os.environ['ADDONS_TO_LOAD']))),
        allow_modify_external_python=os.environ['ALLOW_MODIFY_EXTERNAL_PYTHON'] == "yes",
    )
except Exception as e:
    if type(e) is not SystemExit:
        traceback.print_exc()
        sys.exit()
