> [!TIP] 
> Check [CHANGELOG](./CHANGELOG.md) for changes and new features.
> 
> Prefer the previous layout? Browse the [classic README](https://github.com/JacquesLucke/blender_vscode/blob/b4c6ebba67172d9425f28533e0ece5cac1977da6/README.md).

# Blender VS Code

**Blender addon development with python debugger.** Everything you need is available through the `Blender` command palette menu (press `Ctrl+Shift+P`).

## Table of Contents
- [Blender VS Code](#blender-vs-code)
  - [Table of Contents](#table-of-contents)
  - [Quick Start](#quick-start)
  - [Addon Development](#addon-development)
    - [Creating a new addon](#creating-a-new-addon)
    - [Opening an existing addon](#opening-an-existing-addon)
    - [Environment Isolation](#environment-isolation)
  - [Script Tools](#script-tools)
  - [Customization \& Shortcuts](#customization--shortcuts)
    - [Keyboard Shortcuts](#keyboard-shortcuts)
  - [Troubleshooting \& Logs](#troubleshooting--logs)
  - [Status \& Contribution](#status--contribution)

## Quick Start
1. Install the extension the same way you install any VS Code extension (id: `JacquesLucke.blender-development`).
2. Open the addon folder (one per workspace) and press `Ctrl+Shift+P` → `Blender: Start`.
3. Choose a Blender executable (any Blender ≥ 2.8.34) and wait for the session to launch.
4. Use `Blender: Reload Addons` after editing your addon and `Blender: Run Script` to execute scripts.

> Opening Blender for the first time may take longer because dependency libraries are set up automatically.

## Addon Development

[Extensions](https://docs.blender.org/manual/en/4.2/advanced/extensions/getting_started.html) and legacy addons (pre Blender 4.2) are supported.
For migration guide visit [Legacy vs Extension Add-ons](https://docs.blender.org/manual/en/4.2/advanced/extensions/addons.html#legacy-vs-extension-add-ons).
VS code uses the [automatic logic to determine if you are using addon or extension](./EXTENSION-SUPPORT.md)

> [!NOTE] 
> VS Code automatically creates permanent symlinks (junctions on Windows) so your addon is visble inside Blender:
>  - Addons: `bpy.utils.user_resource("SCRIPTS", path="addons")`
>  - Extensions: `bpy.utils.user_resource("EXTENSIONS", path="vscode_development")`

### Creating a new addon
- Run **`Blender: New Addon`** to scaffold a ready-to-use addon folder. The wizard asks which template to use, where to save the addon (prefer an empty folder without spaces), what to name it, and who is authoring it.
- Once the scaffold exists, open it in VS Code to start developing. All commands, including reload and script runners, work immediately because VS Code creates the required symlinks.

### Opening an existing addon
- This extension works with folder-based addons or extensions. If your addon is just single file `something.py`, move it into a folder and rename the file to `__init__.py`.
- Open the folder for your addon in VS Code, run `Ctrl+Shift+P` → `Blender: Start`, and point the command at a Blender executable (Blender ≥ 2.8.34). The terminal output appears inside VS Code and you can debug as usual with breakpoints.
- The very first launch can take longer because Blender installs the required Python dependencies automatically; keep a stable internet connection during that run.
- Debugging is limited to workspace files by default. Disable [`blender.addon.justMyCode`](vscode://settings/blender.addon.justMyCode) if you want to step into third-party libraries (caution: this can make Blender less stable in rare cases).
- Use `Blender: Reload Addons` after each change (requires Blender started via the extension).
- Enable [`blender.addon.reloadOnSave`](vscode://settings/blender.addon.reloadOnSave) to trigger reload automatically on save.


> [!WARNING]
> In some cases uninstalling addon using Blender Preferences UI interface [might lead to data loss](./EXTENSION-SUPPORT.md#uninstall-addon-and-cleanup). So don't use UI to uninstall, just delete the link manually.

### Environment Isolation
Set [`blender.environmentVariables`](vscode://settings/blender.environmentVariables) to point Blender to a dedicated development workspace:

```json
"blender.environmentVariables": {
  "BLENDER_USER_RESOURCES": "${workspaceFolder}/blender_vscode_development"
}
```

<details>

<summary>
This keeps settings, addons, and user scripts separate from your daily Blender setup.

You can also specify the finer-grained `BLENDER_USER_*` variables listed here:

</summary>

```
Environment Variables:
  $BLENDER_USER_RESOURCES  Replace default directory of all user files.
                           Other 'BLENDER_USER_*' variables override when set.
  $BLENDER_USER_CONFIG     Directory for user configuration files.
  $BLENDER_USER_SCRIPTS    Directory for user scripts.
  $BLENDER_USER_EXTENSIONS Directory for user extensions.
  $BLENDER_USER_DATAFILES  Directory for user data files (icons, translations, ..).
```

</details>

## Script Tools
This extension helps you write, run, and debug standalone Blender scripts that are not full addons.

> [!WARNING]
> Running scripts from VS Code occasionally crashes Blender. Keep your work saved and restart Blender if it becomes unresponsive. Don't go crazy with you scripts!

- Execute `Blender: New Script` and follow the prompts to create a script in your chosen folder.
- Run `Blender: Run Script` to execute every script in any open Blender session started through VS Code. Blender will automatically start if no instances are running.
- Insert a comment like `#context.area: VIEW_3D` or run `Blender: Set Script Context` to control where scripts execute.
- Pass CLI arguments to python script by adding them after `--` in [`blender.additionalArguments`](vscode://settings/blender.additionalArguments) (they become available in `sys.argv`). Note: newer approach is to register command with [`bpy.utils.register_cli_command`](https://docs.blender.org/api/current/bpy.utils.html#bpy.utils.register_cli_command) (Blender 4.2 and newer) and use `--command` to call it.

**Common pitfalls**:
- Avoid calling `sys.exit` inside Blender scripts (see [sys.exit gotcha](https://docs.blender.org/api/current/info_gotchas_crashes.html#sys-exit)).
- Prefer `bpy.utils.register_cli_command` when wiring command line entry points.


## Customization & Shortcuts
The extension is driven by settings (search for `blender.` inside VS Code settings). A few useful ones:
- [`blender.additionalArguments`](vscode://settings/blender.additionalArguments): pass extra CLI flags and optionally a default `.blend` file (prefer this as the last argument).
- [`blender.preFileArguments`](vscode://settings/blender.preFileArguments) / [`blender.postFileArguments`](vscode://settings/blender.postFileArguments): control where Blender expects file names in the argument list.
- [`blender.executables`](vscode://settings/blender.executables): register frequently used Blender installations and **mark one with `"isDefault": true` to keep prompts silent**.
- [`blender.addon.justMyCode`](vscode://settings/blender.addon.justMyCode): disable to step into third-party libraries while debugging.
- [`blender.addon.reloadOnSave`](vscode://settings/blender.addon.reloadOnSave): reload addons every time a workspace file changes while Blender is running.
- [`blender.addon.logLevel`](vscode://settings/blender.addon.logLevel): control the verbosity of the Blender output channel for debugging.
<details>
<summary>
<a href="vscode://settings/blender.addon.buildTaskName"><code>blender.addon.buildTaskName</code></a>: VS Code task name that is executed before addon start and on every addon reload (output shown in terminal). See detailed example:

</summary>

1. Open `tasks.json` (`crtl+shift+p` and search `Tasks: Open User Tasks`)
2. Add task:
```
{
  "version": "2.0.0",
  "tasks": [
      {
          "label": "my-blender-reload-task",
          "type": "shell",
          "command": "echo Hello",
          "problemMatcher": []
      }
  ]
}
```
3. Configure [`blender.addon.buildTaskName`](vscode://settings/blender.addon.buildTaskName) set to `my-blender-reload-task`
4. Task will be triggered before every `Blender: Start` and `Blender: Reload Addons` for every addon in workspace

</details>

### Keyboard Shortcuts

Add shorcuts by editing `keybindings.json` (`crtl+shift+p` and search for `Preferences: Open Keyborad Shortcuts (JSON)`).

<details>
<summary>
<code>Blender: Start</code> shortcut:
</summary>

```json
{
  "key": "ctrl+h",
  "command": "blender.start"
}
```

</details>

<details>
<summary>
<code>Blender: Start</code> shortcut, but with specific executable or script:
</summary>

```json
{
  "key": "ctrl+h",
  "command": "blender.start",
  "args": {
    "blenderExecutable": { "path": "C:\\path\\blender.exe" },
    "script": "C:\\path\\script.py"
  }
}
```
</details>

<details>
<summary>
<code>Blender: Run Script</code> shortcut:
</summary>

```json
{
  "key": "ctrl+shift+enter",
  "command": "blender.runScript",
  "when": "editorLangId == 'python'"
}
```

</details>

## Troubleshooting & Logs
- Use the latest VS Code and Blender builds.
- Check `CHANGELOG.md` for breaking changes.
- Search issues on GitHub before filing a new one.
- Enable debug logs via [`blender.addon.logLevel`](vscode://settings/blender.addon.logLevel) and inspect the `Blender` output channel in VS Code.

## Status & Contribution
- The extension is no longer in active feature development.
- Bugs are welcome; please file issues with as much detail as possible.
- Want to help? Follow the instructions in [DEVELOPMENT.md](./DEVELOPMENT.md) to get started.
