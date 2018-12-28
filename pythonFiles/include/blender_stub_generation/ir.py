from typing import List, Optional, Dict, Set
from dataclasses import dataclass, field
from enum import Enum

__all__ = (
    "PackageIR",
    "ModuleIR",
    "ClassIR",
    "FunctionIR",
    "ValueIR",
    "MethodIR",
    "PropertyIR",
    "ParametersIR",
    "ParameterIR",
    "TypeIR",
    "MethodType"
)

class MethodType(Enum):
    Normal = "NORMAL"
    ClassMethod = "CLASS_METHOD"
    StaticMethod = "STATIC_METHOD"

@dataclass
class PackageIR:
    name: str
    subpackages: List["PackageIR"] = field(default_factory=list)
    submodules: List["ModuleIR"] = field(default_factory=list)
    main_module: "ModuleIR" = field(default_factory=lambda: ModuleIR("__init__"))

@dataclass
class ModuleIR:
    name: str
    classes: List["ClassIR"] = field(default_factory=list)
    functions: List["FunctionIR"] = field(default_factory=list)
    values: List["ValueIR"] = field(default_factory=list)

@dataclass
class ClassIR:
    name: str
    methods: List["MethodIR"] = field(default_factory=list)
    properties: List["PropertyIR"] = field(default_factory=list)

@dataclass
class FunctionIR:
    name: str
    parameters: "ParametersIR" = field(default_factory=lambda: ParametersIR())
    return_type: Optional["TypeIR"] = field(default=None)
    description: str = field(default_factory=str)

@dataclass
class ValueIR:
    name: str
    data_type: Optional["TypeIR"] = field(default=None)
    value: Optional[str] = field(default=None)

@dataclass
class MethodIR:
    method_type: MethodType
    function: "FunctionIR"

@dataclass
class ParametersIR:
    positional: List["ParameterIR"] = field(default_factory=list)
    keyword_only: List["ParameterIR"] = field(default_factory=list)

@dataclass
class PropertyIR:
    name: str
    data_type: Optional["TypeIR"] = field(default=None)

@dataclass
class ParameterIR:
    name: str
    data_type: Optional["TypeIR"] = field(default=None)
    default: Optional[str] = field(default=None)

@dataclass
class TypeIR:
    # e.g. 'list', 'pathlib.Path', 'bpy.types.Scene'
    name: str
    imports: Dict[str, Set[str]] = field(default_factory=dict)