import os
import bpy
import sys
import traceback
import importlib.util
from pathlib import Path
from . environment import addon_directory
from . communication import send_dict_as_json

def load(addon_paths):
    setup_addon_loader(addon_paths)
    
    for addon_path in addon_paths:
        try:
            bpy.ops.wm.addon_enable(module=Path(addon_path).name)
        except:
            traceback.print_exc()
            send_dict_as_json({"type" : "enableFailure", "addonPath" : str(addon_path)})

def setup_addon_loader(addon_paths):
    class AddonFinder:
        @classmethod
        def find_spec(cls, fullname, path, target=None):
            for path in map(Path, addon_paths):
                if fullname == path.name:
                    return importlib.machinery.PathFinder.find_spec(fullname, [str(path.parent)], target)

    sys.meta_path.append(AddonFinder)