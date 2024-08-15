from pathlib import Path
import bpy
import queue
import traceback


def is_addon_legacy(addon_dir: Path):
    """Return whether an addon uses the legacy bl_info behavior, or the new blender_manifest behavior"""
    if bpy.app.version < (4, 2, 0):
        return True
    if not (addon_dir / "blender_manifest.toml").exists():
        return True
    return False


def redraw_all():
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            area.tag_redraw()


def get_prefixes(all_names, separator):
    return set(name.split(separator)[0] for name in all_names if separator in name)


execution_queue = queue.Queue()


def run_in_main_thread(func):
    execution_queue.put(func)


def always():
    while not execution_queue.empty():
        func = execution_queue.get()
        try:
            func()
        except Exception:
            traceback.print_exc()
    return 0.1


bpy.app.timers.register(always, persistent=True)
