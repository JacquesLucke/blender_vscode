from . import to_ir__bpy
from . import ir_to_stubs

def generate(target_path):
    packages = [
        to_ir__bpy.generate(),
    ]

    ir_to_stubs.generate_packages(packages, target_path)