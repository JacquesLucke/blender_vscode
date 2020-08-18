import bpy
import random

def redraw_all():
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            area.tag_redraw()

def get_random_port():
    return random.randint(2000, 10000)
