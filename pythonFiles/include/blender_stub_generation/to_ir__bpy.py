import bpy
import inspect
from collections import defaultdict
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
            classes=[generate_types_class(name, cls) for name, cls in inspect.getmembers(bpy.types) if "_OT_" not in name]))


def generate_types_class(name, cls):
    return ClassIR(name,
        methods=generate_types_class_methods(cls),
        properties=generate_types_class_properties(cls))

def generate_types_class_methods(cls):
    return [generate_types_class_method(cls, meth) for meth in cls.bl_rna.functions]

def generate_types_class_method(cls, meth):
    name = meth.identifier
    method_type = MethodType.Normal
    if hasattr(cls, name):
        func = getattr(cls, name)
        if inspect.ismethod(func) and func.__self__ is cls:
            method_type = MethodType.ClassMethod

    function = FunctionIR(name,
        parameters=generate_types_class_method_parameters(meth, method_type),
        description=meth.description,
        return_type=get_types_class_method_return_type(meth))
    return MethodIR(method_type, function)

def generate_types_class_method_parameters(meth, method_type):
    params = [generate_types_class_method_parameter(param) for param in meth.parameters]
    if method_type == MethodType.Normal:
        params = [ParameterIR("self")] + params
    elif method_type == MethodType.ClassMethod:
        params = [ParameterIR("cls")] + params
    return ParametersIR(
        positional=params)

def generate_types_class_method_parameter(param):
    return ParameterIR(param.identifier)

def get_types_class_method_return_type(meth):
    outputs = [param for param in meth.parameters if param.is_output]
    if len(outputs) == 0:
        return None
    elif len(outputs) == 1:
        return get_rna_data_type(outputs[0])
    else:
        types = [get_rna_data_type(param) for param in outputs]
        all_imports = defaultdict(set)
        for t in types:
            for key, values in t.imports.items():
                all_imports[key].update(values)
        return TypeIR(
            f"Tuple[{', '.join(t.name for t in types)}]",
            dict(all_imports))

def generate_types_class_properties(cls):
    return [generate_types_class_property(prop) for prop in cls.bl_rna.properties]

def generate_types_class_property(prop):
    return PropertyIR(prop.identifier,
        data_type=get_rna_data_type(prop))

def get_rna_data_type(prop):
    if prop.type == "BOOLEAN": return TypeIR("bool")
    elif prop.type == "INT": return TypeIR("int")
    elif prop.type == "STRING": return TypeIR("str")
    elif prop.type == "ENUM": return TypeIR("str")
    elif prop.type == "COLLECTION":
        if prop.srna is None:
            type_name = prop.fixed_type.identifier
            return TypeIR(f"List[{type_name}]",
                {"bpy.types" : {type_name},
                 "typing" : {"List"}})
        else:
            type_name = prop.srna.identifier
            return TypeIR(type_name, {"bpy.types" : {type_name}})
    elif prop.type == "FLOAT":
        if prop.array_length <= 1:
            return TypeIR("float")
        elif prop.subtype == "MATRIX":
            return TypeIR("Matrix", {"mathutils" : {"Matrix"}})
        elif prop.subtype in ("TRANSLATION", "XYZ", "COORDINATES", "DIRECTION"):
            return TypeIR("Vector", {"mathutils" : {"Vector"}})
        elif prop.subtype in ("COLOR", "COLOR_GAMMA"):
            return TypeIR("Color", {"mathutils" : {"Color"}})
        elif prop.subtype == "EULER":
            return TypeIR("Euler", {"mathutils" : {"Euler"}})
        elif prop.subtype == "QUATERNION":
            return TypeIR("Quaternion", {"mathutils" : {"Quaternion"}})
        elif prop.subtype in ("NONE", "FACTOR", "UNSIGNED", "DISTANCE", "PIXEL"):
            return TypeIR(f"Tuple[{', '.join(['float'] * prop.array_length)}]", {"typing" : {"Tuple"}})
    elif prop.type == "POINTER":
        type_name = prop.fixed_type.identifier
        return TypeIR(type_name, {"bpy.types" : {type_name}})
    assert False, f"Property type not handled: {prop} - {prop.type} - {prop.subtype}"


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