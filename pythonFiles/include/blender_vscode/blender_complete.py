import importlib
from pathlib import Path
from types import ModuleType
from typing import Literal, TypedDict, List, Dict
from .communication import send_dict_as_json
import jedi
import jedi.api
from jedi.api.environment import InterpreterEnvironment

from . import log

LOG = log.getLogger()

jedi.settings.fast_parser = False  # Obligatory! Otherwise Jedi fails to find Blender modules.
jedi.settings.allow_unsafe_interpreter_executions = True
jedi.api.set_debug_function(speed=False)


class Position(TypedDict):
    line: int
    character: int


class CompletionContext(TypedDict):
    type: Literal["complete"]
    path: str
    position: Position
    text: str


# auto import must be set, it is needed for completing `import bpy; bpy.app.<tab>`. Not sure why.
jedi.settings.auto_import_modules = BLENDER_INTERNAL_MODULES = [
    # "bpy",
    "_bpy",
    # static _inittab bpy_internal_modules from `source/blender/python/intern/bpy_interface.cc`
    "mathutils",
    "mathutils.geometry",
    "mathutils.noise",
    "mathutils.kdtree",
    "_bpy_path",
    "bgl",
    "blf",
    "bl_math",
    "imbuf",
    "bmesh",
    "bmesh.types",
    "bmesh.utils",
    "bmesh.utils",
    "manta",
    "aud",
    "_cycles",
    "gpu",
    "idprop",
    "_bpy_hydra",
]


def import_blender_embedded_modules() -> List[Dict[str, ModuleType]]:
    # todo optimize
    # this is pretty good way of getting modules, but we might miss some magic like setting globals directly
    return {mod: importlib.import_module(mod) for mod in BLENDER_INTERNAL_MODULES}


class BlenderInterpreter(jedi.Script):
    _get_module_context = jedi.Interpreter._get_module_context

    def __init__(self, code, namespaces, project=None, **kwds):
        try:
            namespaces = [dict(n) for n in namespaces]
        except Exception:
            raise TypeError("namespaces must be a non-empty list of dicts.")

        environment = kwds.get("environment", None)
        if environment is None:
            environment = InterpreterEnvironment()
        else:
            if not isinstance(environment, InterpreterEnvironment):
                raise TypeError("The environment needs to be an InterpreterEnvironment subclass.")

        super().__init__(code, environment=environment, project=project, **kwds)

        self.namespaces = namespaces
        self._inference_state.allow_unsafe_executions = jedi.settings.allow_unsafe_interpreter_executions
        self._inference_state.do_dynamic_params_search = False


def complete(context: CompletionContext):
    # todo make sure all blender pythonpaths are added
    # todo make sure project path makes sense with VS code workspace
    # todo file from editor might be unsaved
    # todo make sure project uses blender (embedded) interpreter
    embedded_modules = import_blender_embedded_modules()
    project = jedi.Project(
        path=Path.cwd(),
        load_unsafe_extensions=True,
    )
    i = BlenderInterpreter(
        code=context["text"],
        namespaces=[embedded_modules],
        project=project,
    )
    line, column = int(context["position"]["line"]), int(context["position"]["character"])
    completions: List[jedi.api.Completion] = i.complete(line + 1, column, fuzzy=True)
    if completions:
        LOG.debug(f"Found completions: [{completions[0]}...] ({len(completions)})")
    else:
        LOG.debug(f"Found completions: {completions}")
    return list(map(lambda c: c.name, completions))
