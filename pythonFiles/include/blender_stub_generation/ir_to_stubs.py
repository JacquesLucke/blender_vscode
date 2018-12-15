import os
import shutil
import textwrap
from typing import List
from pathlib import Path
from . ir import *

def generate_packages(packages: List[PackageIR], include_path: str):
    include_path = Path(include_path)
    for package in packages:
        generate_package(package, include_path)

def generate_package(package: PackageIR, include_path):
    path = include_path / package.name
    print("Writing Output:", path)

    if path.exists():
        shutil.rmtree(path)
    os.makedirs(path)

    for subpackage in package.subpackages:
        generate_package(subpackage, path)

    for module in package.submodules:
        generate_module(module, path)

    generate_module(package.main_module, path)

def generate_module(module: ModuleIR, parent_path):
    path = parent_path / (module.name + ".py")

    parts = []
    parts.append("import typing")
    for cls in module.classes:
        parts.append("\n".join(iter_class_lines(cls)))
    for function in module.functions:
        parts.append("\n".join(iter_function_lines(function)))
    for value in module.values:
        parts.append("\n".join(iter_value_lines(value)))

    code = "\n\n".join(parts)
    with open(path, "wt") as f:
        f.write(code)

def iter_class_lines(cls: ClassIR):
    yield f"class {cls.name}:"
    for prop in cls.properties:
        yield "    " + get_property_line(prop)
    yield "    pass"

def get_property_line(prop):
    if prop.data_type is None:
        return f"{prop.name}: typing.Any"
    else:
        return f"{prop.name}: {prop.data_type}"

def iter_function_lines(function: FunctionIR):
    yield f"def {function.name}({generate_parameters(function.parameters)}):"
    yield from indent(iter_function_description_lines(function.description))
    yield "    ..."

def iter_value_lines(value: ValueIR):
    if value.value is None:
        if value.data_type is None:
            yield f"{value.name}: typing.Any = object()"
        else:
            yield f"{value.name}: {value.data_type} = object()"
    else:
        if value.data_type is None:
            yield f"{value.name}: typing.Any = {value.value}"
        else:
            yield f"{value.name}: {value.data_type} = {value.value}"

def generate_parameters(params: ParametersIR):
    positional = ", ".join(p.name for p in params.positional)
    keyword_only = ", ".join(p.name for p in params.keyword_only)
    if len(keyword_only) == 0:
        return positional
    elif len(positional) == 0:
        return "*, " + keyword_only
    else:
        return f"{positional}, *, {keyword_only}"

def iter_function_description_lines(description: str):
    if len(description) > 0:
        yield "'''"
        yield from description.splitlines()
        yield "'''"

def indent(lines, steps=1):
    prefix = "    " * steps
    yield from (prefix + line for line in lines)