import bpy
from ..communication import register_post_action


def stop_action(data):
    bpy.ops.wm.quit_blender()


def register():
    register_post_action("stop", stop_action)
