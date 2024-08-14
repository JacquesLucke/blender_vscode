import os
import subprocess
import sys
from typing import Optional, Union


def resolve_link(path: Union[str, os.PathLike]) -> Optional[str]:
    """Return target if is symlink or junction else return None"""
    try:
        return os.readlink(str(path))
    except OSError as e:
        # OSError: [WinError 4390] The file or directory is not a reparse point
        if e.winerror == 4390:
            return None
        # FileNotFoundError: [WinError 2] The system cannot find the file specified
        if e.winerror == 2:
            return None
        else:
            raise e
    except ValueError as e:
        # there are major differences in python windows junction support (3.7.0 and 3.7.9 give different errors)
        if sys.platform == "win32":
            return _resolve_link_windows_cmd(path)
        else:
            print("Warning: can not resolve link target", e)
            return None


def _resolve_link_windows_cmd(path: Union[str, os.PathLike]) -> Optional[str]:
    IO_REPARSE_TAG_MOUNT_POINT = "0xa0000003"
    JUNCTION_INDICATOR = f"Reparse Tag Value : {IO_REPARSE_TAG_MOUNT_POINT}"
    try:
        output = subprocess.check_output(["fsutil", "reparsepoint", "query", str(path)])
    except subprocess.CalledProcessError:
        return None
    output_lines = output.decode().split(os.linesep)
    if not output_lines[0].startswith(JUNCTION_INDICATOR):
        return None
    TARGET_PATH_INDICATOR = "Print Name:            "
    for line in output_lines:
        if line.startswith(TARGET_PATH_INDICATOR):
            possible_target = line[len(TARGET_PATH_INDICATOR) :]
            if os.path.exists(possible_target):
                return possible_target
