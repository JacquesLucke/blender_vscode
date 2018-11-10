import os
import sys
import bpy

addon_directory = bpy.utils.user_resource('SCRIPTS', "addons")
external_addon_directory = os.environ['ADDON_DEV_DIR']

addon_folder_name = os.path.basename(external_addon_directory)
symlink_path = os.path.join(addon_directory, addon_folder_name)

if not os.path.exists(addon_directory):
    os.makedirs(addon_directory)
if os.path.exists(symlink_path):
    os.remove(symlink_path)

os.symlink(external_addon_directory, symlink_path, target_is_directory=True)

bpy.ops.wm.addon_enable(module=addon_folder_name)