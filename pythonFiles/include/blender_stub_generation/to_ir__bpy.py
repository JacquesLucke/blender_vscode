import bpy
import inspect
from . ir import *

def generate():
    return PackageIR("bpy", [
        generate_ops(),
        generate_types(),
        generate_app(),
    ])


# bpy.ops
##########################################

def generate_ops():
    return PackageIR("ops",
        submodules=[generate_ops_group(group) for group in dir(bpy.ops)])

def generate_ops_group(group):
    ops = getattr(bpy.ops, group)
    return ModuleIR(group,
        functions=[generate_ops_function(name, getattr(ops, name))
            for name in dir(ops)])

def generate_ops_function(name, op):
    rna = op.get_rna_type()
    props = [prop for prop in rna.properties if prop.identifier != "rna_type"]
    params = ParametersIR(
        keyword_only=[ParameterIR(prop.identifier) for prop in props])

    return FunctionIR(name,
        parameters=params,
        description=rna.description)


# bpy.types
##########################################

def generate_types():
    return PackageIR("types",
        submodules=[ModuleIR("test",
            classes=[generate_types_class(name, cls) for name, cls in inspect.getmembers(bpy.types)])])


def generate_types_class(name, cls):
    return ClassIR(name)


# bpy.app
##########################################

def generate_app():
    return PackageIR("app")