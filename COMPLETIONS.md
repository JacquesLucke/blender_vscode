WIP, just a brain dump:

Provide dynamic autocompletion from running Blender instance.

Features in this PR:
- [ ] this feature is considered experimental. Add setting for enabling it in VS code `blender.codeCompletion`
- [ ] add Jedi as dependency. Jedi is main provider of autocompletions.
- [ ] check how well Jedi can extract types from doc strings.
- [ ] idea: if completion item is constant, 
  - [ ] display it inline? 
  - [ ] display in completion item?
  - [ ] display it on hover?
- todo: design how to integrate this completions with VS code refactoring? 
  - for example this error: `Import "bpy" could not be resolved Pylance reportMissingImports`
  - language server protocol? Completion provider? 
- todo: design how autocomplete works with multiple Blender instances

Autocompletion checklist:
- [ ] autocomplete basic attributes: `bpy.app.'<tab>`
- [ ] autocomplete collection keys: `bpy.data.objects["<tab>`
- [ ] autocomplete operators: `bpy.ops.object.<tab>`
  - [ ] also verify C defined operators like `bpy.ops.view3d.move(` 
  - [ ] also verify operators created by addons dynamically
- [ ] autocomplete help and function params: `bpy.ops.object.duplicate(<tab>`
- [ ] autocomplete properties: `bpy.props.<tab>`
- [ ] autocomplete properties when used in class
- [ ] autocomplete context: `bpy.context.<tab>`
  - todo: design how to pin context to specific context type
- todo: design how to complete overrides
- [ ] verify basic completions for modules. We can find blender internal C-defined python modules by searching blender source code for `PyModule_Create` and `PyModuleDef` and `bpy_internal_modules`:
  - [ ] `bpy`, `_bpy`
  - [ ] `addon_utils`
  - [ ] `mathutils`
  - [ ] `bl_ext`
  - [ ] `bl_pkg`
  - [ ] `bl_math`
- [ ] verify autocomplete for operators in classes
```python
from bpy.types import Menu
class ANIM_MT_keyframe_insert_pie(Menu):
    bl_label = "Keyframe Insert Pie"
    # are functions from base class complted?
    def draw(self, context):
        layout = self.layout # is layout autocompleted?
        pie = layout.menu_pie() # is pie autocompleted?
```

Future goals:


Non-goals: