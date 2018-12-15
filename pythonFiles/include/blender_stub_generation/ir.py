from typing import List
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
    return_value: "ParameterIR" = field(default_factory=list)
    description: str = field(default_factory=str)

@dataclass
class ValueIR:
    name: str
    data_type: str = field(default=None)
    value: str = field(default=None)

@dataclass
class MethodIR:
    method_type: str
    function: "FunctionIR"

@dataclass
class ParametersIR:
    positional: List["ParameterIR"] = field(default_factory=list)
    keyword_only: List["ParameterIR"] = field(default_factory=list)

    @classmethod
    def from_string(cls, string):
        positional = []
        for part in string.split(","):
            positional.append(ParameterIR(part.strip()))
        return cls(positional=positional)

@dataclass
class PropertyIR:
    name: str
    data_type: str = field(default=None)

@dataclass
class ParameterIR:
    name: str
    data_type: str = field(default=None)
    default: str = field(default=None)
