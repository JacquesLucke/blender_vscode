from pprint import pformat

from .autocomplete_locals import BUILTIN_LOCALS
from . import log
import bpy


from bl_console_utils.autocomplete import intellisense

complete_locals = {}
complete_locals.update(BUILTIN_LOCALS)


LOG = log.getLogger()


def complete(data):
    line: str = data["line"]
    current_character: str = data["current_character"]

    resultExpand = intellisense.expand(line=line, cursor=current_character, namespace=complete_locals, private=True)

    resultComplete = intellisense.complete(line=line, cursor=current_character, namespace=complete_locals, private=True)

    if resultComplete[0]:
        for result in resultComplete[0]:
            yield {"complete": result, "description": "", "prefixToRemove": resultComplete[1]}
    else:
        yield {"complete": resultExpand[0], "description": resultExpand[2]}
