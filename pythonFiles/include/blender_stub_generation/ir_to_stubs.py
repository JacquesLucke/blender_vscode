import os
import shutil
import textwrap
import itertools
from typing import List
from pathlib import Path
from typing import Dict, Set
from collections import defaultdict

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

    imports: Dict[str, Set[str]] = defaultdict(set)

    parts = []
    for cls in module.classes:
        parts.append("\n".join(iter_class_lines(cls, imports)))
    for function in module.functions:
        parts.append("\n".join(iter_function_lines(function, imports)))
    for value in module.values:
        parts.append("\n".join(iter_value_lines(value, imports)))

    parts.insert(0, "\n".join(iter_import_lines(imports)))

    code = "\n\n".join(parts)
    with open(path, "wt") as f:
        f.write(code)

def iter_class_lines(cls: ClassIR, imports):
    yield f"class {cls.name}:"
    for prop in cls.properties:
        yield "    " + get_property_line(prop, imports)
    yield "    pass"

def get_property_line(prop, imports):
    if prop.data_type is None:
        return f"{prop.name}: typing.Any"
    else:
        insert_import(imports, prop.data_type)
        return f"{prop.name}: {prop.data_type}"

def iter_function_lines(function: FunctionIR, imports):
    yield f"def {function.name}({generate_parameters(function.parameters, imports)}):"
    yield from indent(iter_function_description_lines(function.description))
    yield "    ..."

def iter_value_lines(value: ValueIR, imports):
    if value.value is None:
        if value.data_type is None:
            yield f"{value.name}: typing.Any = object()"
        else:
            insert_import(value.data_type)
            yield f"{value.name}: {value.data_type.name} = object()"
    else:
        if value.data_type is None:
            yield f"{value.name}: typing.Any = {value.value}"
        else:
            insert_import(value.data_type)
            yield f"{value.name}: {value.data_type.name} = {value.value}"

def iter_import_lines(imports):
    for src, names in imports.items():
        yield f"from {src} import {', '.join(names)}"

def generate_parameters(params: ParametersIR, imports):
    positional = ", ".join(get_parameter_declaration(p, imports) for p in params.positional)
    keyword_only = ", ".join(get_parameter_declaration(p, imports) for p in params.keyword_only)
    if len(keyword_only) == 0:
        return positional
    elif len(positional) == 0:
        return "*, " + keyword_only
    else:
        return f"{positional}, *, {keyword_only}"

def get_parameter_declaration(param: ParameterIR, imports):
    if param.data_type is None:
        return param.name
    else:
        insert_import(param.data_type, imports)
        return f"{param.name}: {param.data_type.name}"

def iter_function_description_lines(description: str):
    if len(description) > 0:
        yield "'''"
        yield from description.splitlines()
        yield "'''"

def indent(lines, steps=1):
    prefix = "    " * steps
    yield from (prefix + line for line in lines)

def insert_import(data_type: TypeIR, imports):
    src = data_type.source
    name = data_type.name
    if src is not None:
        imports[src].add(name)