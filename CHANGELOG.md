# Changelog

## Unreleased

### Changed

- Disconnecting debug session will now hard close/terminate blender

### Added

- A `blender.executable` can be now marked as default.
  - When no blender is marked as default, a notification will appear after and offer setting it as default 
```json
"blender.executables": [
  {
    "name": "blender-4.5.1",
    "path": "C:\\...\\blender-4.5.1-windows-x64\\blender.exe",
    "isDefault": true
  }
]
```
- Run `Blender: Start` using single button by adding snippet to `keybindings.json`. Other commands are not supported.

Simple example:
```json
{
    "key": "ctrl+h",
    "command": "blender.start",
}
```

Advanced example:
```json
{
  "key": "ctrl+h",
  "command": "blender.start",
  "args": {
    "blenderExecutable": {
      "path": "C:\\...\\blender.exe" 
    },
    // optional, run script after debugger is attached, must be absolute path
    "script": "C\\script.py"
  }
}
```
- Improvements for `Blender: Run Script`:
  - When **no** Blender instances are running, start blender automatically
  - When Blender instances are running, just run the script on all available instances (consistant with old behavior)
  - Run `Blender: Run Script` using single button by adding snippet to `keybindings.json`. 

Simple example:
```json
{
  "key": "ctrl+shift+enter",
  "command": "blender.runScript",
  "when": "editorLangId == 'python'"
}
```

Advanced example:
```json
{
  "key": "ctrl+shift+enter",
  "command": "blender.runScript",
  "args": {
    // optional, same format as item in blender.executables
    // if missing user will be prompted to choose blender.exe or default blender.exe will be used
    "blenderExecutable": { 
      "path": "C:\\...\\blender.exe" 
    },
    // optional, run script after debugger is attached, must be absolute path, defaults to current open file
    "script": "C:\\script.py"
  },
  "when": "editorLangId == 'python'"
}
```

### Removed

- Removed dependency on `ms-vscode.cpptools` what causes problems for other editors #235, #157. There is no plans to further support Blender Core develompent in this addon.
- Deprecated setting: `blender.core.buildDebugCommand`
- Removed commands:
  - `blender.build`
  - `blender.buildAndStart`
  - `blender.startWithoutCDebugger`
  - `blender.buildPythonApiDocs`


## [0.0.26] - 2025-08-14

### Added

- Run `Blender: Start` using single button by adding snippet to `keybindings.json`. Other Commands (like `Blender: Build and Start`) are not supported ([#199](https://github.com/JacquesLucke/blender_vscode/pull/199)).
```json
{
  "key": "ctrl+h",
  "command": "blender.start",
  "args": {
    "blenderExecutable": { // optional, same format as item in blender.executables
      "path": "C:\\...\\blender.exe" // optional, if missing user will be prompted to choose blender.exe
    },
    // define command line arguments in setting blender.additionalArguments
}
```
- You can now configure VS Code internal log level using [`blender.addon.logLevel`](vscode://settings/blender.addon.logLevel) ([#198](https://github.com/JacquesLucke/blender_vscode/pull/198))
  - to mute logs set log level to critical
  - to enable more logs set log level to debug
  - changing log level required blender restart
  - logs now have colors
- Print python dependency version (log level info) and path (log level debug) even when it is already installed
- 2 new operators: `blender.openWithBlender` - usable with right click from file explorer and `blender.openFiles` - usable from command palette ([#225](https://github.com/JacquesLucke/blender_vscode/pull/225)).
- 2 new settings: `blender.preFileArguments` and `blender.postFileArguments` - they work only with above new commands. Placement of file path within command line arguments is important, this distincion was needed ([#225](https://github.com/JacquesLucke/blender_vscode/pull/225)).
  - `blender.postFileArguments` can not have `--` in args (it causes invalid syntax). Note: the `--` is used for passing arguments to python scripts inside blender.
  - `blender.additionalArguments` remains unchanged and will work only with `Blender: Start` command.

### Fixed

- Linux only: temporary variable `linuxInode` will no longer be saved in VS Code settings ([#208](https://github.com/JacquesLucke/blender_vscode/pull/208)).

### Changed

- updated dependency engines.vscode to 1.63 (to support beta releases)

## [0.0.25] - 2024-11-07

### Fixed

- Remove clashes with legacy version when linking extension ([#210](https://github.com/JacquesLucke/blender_vscode/pull/210)).

## [0.0.24] - 2024-09-12

### Fixed

- Starting Blender with C and Python debugger.
- Pin Werkzeug library to avoid crash when opening add-ons in user-preferences ([#191](https://github.com/JacquesLucke/blender_vscode/pull/191)).

## [0.0.23] - 2024-09-06

### Added

- Make `.blend` files use the Blender icon (#187)

### Fixed

- Linux and MacOS: fixed `blender.executables` not showing when calling `Blender: Start` (introduced in #179)

## [0.0.22] - 2024-09-04

### Added
- Add setting to specify to which repository install addons from VS code. Default value is `vscode_development` ([#180](https://github.com/JacquesLucke/blender_vscode/pull/180))
- Automatically add Blender executables to quick pick window. Search PATH and typical installation folders ([#179](https://github.com/JacquesLucke/blender_vscode/pull/179))
- If Blender executable does not exist indicate it in quick pick window ([#179](https://github.com/JacquesLucke/blender_vscode/pull/179))
- Support bl_order in auto_load.py (#118)
- Allow user to develop addon even it is placed in directories like (#172)
  - `\4.2\scripts\addons` -> default dir for addons
  - `\4.2\extensions\blender_org` -> directory indicated by `bpy.context.preferences.extensions.repos` (list of directories)
- Remove duplicate links to development (VSCode) directory (#172)
- Remove broken links in addon and extension dir (#172)

### Changed
- Updated dependencies. Now oldest supported VS Code version is `1.28.0` - version from September 2018. ([#147](https://github.com/JacquesLucke/blender_vscode/pull/147))
- Addon_update operator: Check more precisely which module to delete (#175)
- Formatted all python code with `black -l 120` (#167)
- Fix most of the user reported permission denied errors by changing python packages directory ([#177](https://github.com/JacquesLucke/blender_vscode/pull/177)):
  - Instead of installing to system python interpreter (`.\blender-4.2.0-windows-x64\4.2\python\Lib\site-packages`)
  - Install to local blender modules `%appdata%\Blender Foundation\Blender\4.2\scripts\modules` (path indicated by `bpy.utils.user_resource("SCRIPTS", path="modules")`).
  - Existing installations will work fine, it is not a breaking change

### Deprecated
- setting `blender.allowModifyExternalPython` is now deprecated ([#177](https://github.com/JacquesLucke/blender_vscode/pull/177))

### Fixed
- Path to addon indicated by [`blender.addonFolders`](vscode://settings/blender.addonFolders) now works correctly for non-system drive (usually `C:`) on Windows ([#147](https://github.com/JacquesLucke/blender_vscode/pull/147))
- Pinned requests to version 2.29 to maintain compatibility with blender 2.80 ([#177](https://github.com/JacquesLucke/blender_vscode/pull/177))
- Find correct python path for blender 2.92 and before (#174). This partly fixes compatibility with blender 2.80.
- "Blender: Run Script" will no longer open read-only file when hitting debug point (#142)

## [0.0.21] - 2024-07-16

### Added
- Initial support for extensions for Blender 4.2.

## [0.0.20] - 2024-05-01

### Added
- New `blender.addon.justMyCode` option. Previously, this was enabled by default and made it more difficult to debug addons that used external libraries. Restart Blender debug session after changing this option.

### Fixed
- Prioritize addon path mappings to make it more likely that the right path is mapped.

## [0.0.19] - 2023-12-05

### Fixed
- Fixed "Run Script" support for Blender 4.0.

## [0.0.18] - 2023-04-02

### Added
- New `blender.environmentVariables` option. Can be used to define environment variables passed to
blender on `Blender Start`.
- New `blender.additionalArguments` option. Can be used to define additional arguments used when
starting blender on `Blender Start`.

### Changed
- Changed scope of `blender.executables` to `resource`. The value is firstly looked up in workspace
settings before user settings.

### Fixed
- Behavior of scripts that changed context like the active object.

## [0.0.17] - 2022-06-08

### Added
- New `blender.addonFolders` option. Allows to specify absolute or root workspace relative
directories where to search for addons. If not specified all workspace folders are searched.

### Fixed
- Update `get-pip.py`.
- Use `ensurepip` if available.

## [0.0.16] - 2021-06-15

### Fixed
- Fix after api breakage.

## [0.0.15] - 2021-05-10

### Fixed
- Use `debugpy` instead of deprecated `ptvsd`.

## [0.0.14] - 2021-02-27

### Fixed
- Update `auto_load.py` again.

## [0.0.13] - 2021-02-21

### Fixed
- Update `auto_load.py` to its latest version to support Blender 2.93.

## [0.0.12] - 2019-04-24

### Added
- New `blender.addon.moduleName` setting. It controls the name if the generated symlink into the addon directory. By default, the original addon folder name is used.

### Fixed
- Fix detection for possibly bad addon folder names.
- Addon templates did not contain `version` field in `bl_info`.

## [0.0.11] - 2019-03-06

### Added
- New `Blender: Open Scripts Folder` command.
- New `CTX` variable that is passed into scripts to make overwriting the context easier. It can be used when calling operators (e.g. `bpy.ops.object.join(CTX)`). This will hopefully be replaced as soon as I find a more automatic reliable solution.

### Fixed
- Scripts were debugged in new readonly documents on some platforms.
- Addon package was put in `sys.path` in subprocesses for installation.
- Warn user when new addon folder name is not a valid Python module name.
- Path to Blender executable can contain spaces.

## [0.0.10] - 2018-12-02

### Added
- Support for multiple addon templates.
- Addon template with automatic class registration.
- Initial `Blender: New Operator` command.

### Fixed
- Handle path to `.app` file on MacOS correctly ([#5](https://github.com/JacquesLucke/blender_vscode/issues/5)).
- Better error handling when there is no internet connection.
