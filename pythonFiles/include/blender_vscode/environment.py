import logging
import os
import sys
from pathlib import Path
from typing import Optional

import addon_utils
import bpy

_str_to_log_level = {
    "debug-with-flask": logging.DEBUG,
    "debug": logging.DEBUG,
    "info": logging.INFO,
    "warning": logging.WARNING,
    "error": logging.ERROR,
    "critical": logging.CRITICAL,
}


def _parse_log(env_var_name: str) -> int:
    log_env_global = os.environ.get(env_var_name, "info") or "info"
    try:
        return _str_to_log_level[log_env_global]
    except KeyError as e:
        logging.warning(f"Log level for {env_var_name} not set: {e}")
        return logging.WARNING


# binary_path_python was removed in blender 2.92
# but it is the most reliable way of getting python path for older versions
# https://github.com/JacquesLucke/blender_vscode/issues/80
python_path = Path(getattr(bpy.app, "binary_path_python", sys.executable))
blender_path = Path(bpy.app.binary_path)
blender_directory = blender_path.parent

version = bpy.app.version
scripts_folder = blender_path.parent / f"{version[0]}.{version[1]}" / "scripts"
addon_directories = tuple(map(Path, addon_utils.paths()))

EXTENSIONS_REPOSITORY: Optional[str] = os.environ.get("VSCODE_EXTENSIONS_REPOSITORY", "user_default") or "user_default"
LOG_LEVEL_GLOBAL = _parse_log("VSCODE_GLOBAL_LOG_LEVEL")
LOG_LEVEL = _parse_log("VSCODE_LOG_LEVEL")
