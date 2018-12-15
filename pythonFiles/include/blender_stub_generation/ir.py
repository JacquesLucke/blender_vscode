from typing import List, Optional
from dataclasses import dataclass, field

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
)

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
    parameters: "ParametersIR" = field(default_factory=list)
    return_value: Optional["ParameterIR"] = field(default=None)
    description: str = field(default_factory=str)

@dataclass
class ValueIR:
    name: str
    data_type: Optional["TypeIR"] = field(default=None)
    value: Optional[str] = field(default=None)

@dataclass
class MethodIR:
    method_type: str
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
    full_name: str

    @property
    def source(self):
        parts = self.full_name.split(".")
        if len(parts) > 1:
            return ".".join(parts[:-1])

    @property
    def name(self):
        return self.full_name.split(".")[-1]