import os
import shutil
import textwrap
from typing import List
from pathlib import Path
from . ir import *

import bpy
bpy.ops.object.vertex_group_add

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

def generate_module(module: ModuleIR, parent_path):
    path = parent_path / (module.name + ".py")

    parts = []
    for cls in module.classes:
        parts.append("\n".join(iter_class_lines(cls)))
    for function in module.functions:
        parts.append("\n".join(iter_function_lines(function)))

    code = "\n\n".join(parts)
    with open(path, "wt") as f:
        f.write(code)

def iter_class_lines(cls: ClassIR):
    yield f"class {cls.name}:"
    yield "    ..."

def iter_function_lines(function: FunctionIR):
    yield f"def {function.name}({generate_parameters(function.parameters)}):"
    yield from indent(iter_function_description_lines(function.description))
    yield "    ..."

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