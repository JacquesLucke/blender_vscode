import bpy
import queue
import traceback

# This queue is thread safe.
execution_queue = queue.Queue()

def run_in_main_thread(func):
    execution_queue.put(func)

def always():
    while not execution_queue.empty():
        func = execution_queue.get()
        try:
            func()
        except:
            traceback.print_exc()
    return 0.1

def register():
    bpy.app.timers.register(always, persistent=True)
