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
        main_module=ModuleIR("__init__",
            classes=[generate_types_class(name, cls) for name, cls in inspect.getmembers(bpy.types)]))


def generate_types_class(name, cls):
    rna = cls.bl_rna
    return ClassIR(name,
        properties=[PropertyIR(prop.identifier) for prop in rna.properties])


# bpy.app
##########################################

def generate_app():
    return PackageIR("app",
        main_module=ModuleIR("__init__",
            values=list(generate_app_values())),
        submodules=[
            generate_app_timers()
        ])

def generate_app_values():
    non_values = ["handlers", "icons", "timers", "translations"]
    for name in dir(bpy.app):
        if not name.startswith("_") and name not in non_values:
            yield ValueIR(name)

def generate_app_timers():
    return ModuleIR("timers",
        functions=[])