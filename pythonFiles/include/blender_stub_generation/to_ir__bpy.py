import bpy
from . ir import *

def generate():
    return PackageIR("bpy", [
        generate_ops(),
        generate_types(),
        generate_app(),
    ])

def generate_ops():
    return PackageIR("ops")

def generate_types():
    return PackageIR("types")

def generate_app():
    return PackageIR("app")