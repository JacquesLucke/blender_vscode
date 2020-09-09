import os
import sys
import bpy
import json
from pprint import pprint

addons_dir = bpy.utils.user_resource('SCRIPTS', "addons")

addon_sources_json = os.environ['ADDON_SOURCES']
addon_sources = json.loads(addon_sources_json)

files_to_link = addon_sources['addon_files']
directories_to_link = addon_sources['addon_folders']

for src_path in files_to_link:
    file_name = os.path.basename(src_path)
    dst_path = os.path.join(addons_dir, file_name)
    if os.path.exists(dst_path):
        print('Path exists already:', str(dst_path))
        sys.exit(1)

    os.symlink(str(src_path), str(dst_path), target_is_directory=False)

for src_path in directories_to_link:
    folder_name = os.path.basename(src_path)
    dst_path = os.path.join(addons_dir, folder_name)
    if os.path.exists(dst_path):
        print('Path exists already: ', str(dst_path))
        sys.exit(1)

    if sys.platform == 'win32':
        import _winapi
        _winapi.CreateJunction(str(src_path), str(dst_path))
    else:
        os.symlink(str(src_path), str(dst_path), target_is_directory=True)

sys.exit(0)
