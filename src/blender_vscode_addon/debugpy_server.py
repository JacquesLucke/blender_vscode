import bpy
from bpy.props import *
from .utils import get_random_port

active_debugpy_port = None

class StartDebugpyServerOperator(bpy.types.Operator):
    bl_idname = "development.start_debugpy_server"
    bl_label = "Start debugpy Server"
    bl_description = ""

    def execute(self, context):
        global active_debugpy_port
        if active_debugpy_port is not None:
            self.report({'INFO'}, "debugpy server is running already")
            return {'FINISHED'}

        try:
            import debugpy
        except ModuleNotFoundError:
            self.report({'ERROR'}, "debugpy is not installed")
            return {'CANCELLED'}

        tries = 0
        port = 5678
        while tries < 10:
            try:
                debugpy.listen(("0.0.0.0", port))
                break
            except OSError:
                port = get_random_port()
                tries += 1
                pass
        else:
            self.report({'ERROR'}, "Cannot enable debugpy server")
            return {'CANCELLED'}

        active_debugpy_port = port

        from .preferences import send_connection_info
        send_connection_info()
        return {'FINISHED'}

def get_active_debugpy_port():
    return active_debugpy_port

def debugpy_debugger_is_attached():
    if active_debugpy_port is None:
        return False
    import debugpy
    return debugpy.is_client_connected()
