import bpy
from bpy.props import *
from . utils import get_random_port

active_ptvsd_port = None

class StartPtvsdServerOperator(bpy.types.Operator):
    bl_idname = "development.start_ptvsd_server"
    bl_label = "Start ptvsd Server"
    bl_description = ""

    def execute(self, context):
        global active_ptvsd_port
        if active_ptvsd_port is not None:
            self.report({'INFO'}, "ptvsd server is running already")
            return {'FINISHED'}

        try:
            import ptvsd
        except ModuleNotFoundError:
            self.report({'ERROR'}, "ptvsd is not installed")
            return {'CANCELLED'}

        tries = 0
        while tries < 10:
            port = 5678
            try:
                ptvsd.enable_attach(("0.0.0.0", port))
                break
            except OSError:
                port = get_random_port()
                tries += 1
                pass
        else:
            self.report({'ERROR'}, "Cannot enable ptvsd server")
            return {'CANCELLED'}

        active_ptvsd_port = port
        return {'FINISHED'}

def get_active_ptvsd_port():
    return active_ptvsd_port

def ptvsd_debugger_is_attached():
    if active_ptvsd_port is None:
        return False
    import ptvsd
    return ptvsd.is_attached()
