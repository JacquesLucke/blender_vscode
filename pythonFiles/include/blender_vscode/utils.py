import bpy

def redraw_all():
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            area.tag_redraw()

def get_prefixes(all_names, separator):
    return set(name.split(separator)[0] for name in all_names if separator in name)
