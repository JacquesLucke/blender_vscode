import bpy
import json
from pathlib import Path

output_dir = Path(__file__).parent.parent / "generated"
enums_output_path = output_dir / "enums.json"


def insert_enum_data(data, identifier):
    type_name, prop_name = identifier.split(".")
    enum_name = type_name.lower() + prop_name.title() + "Items"
    data[enum_name] = enum_prop_to_dict(type_name, prop_name)


def enum_prop_to_dict(type_name, prop_name):
    type = getattr(bpy.types, type_name)
    prop = type.bl_rna.properties[prop_name]
    return enum_items_to_dict(prop.enum_items)


def enum_items_to_dict(items):
    return [{"identifier": item.identifier, "name": item.name, "description": item.description} for item in items]


data = {}
insert_enum_data(data, "Area.type")

with open(enums_output_path, "w") as f:
    f.write(json.dumps(data, indent=2))
