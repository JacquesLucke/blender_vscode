# Blender Development in VS Code

The only key combination you have to remember is `ctrl+shift+P`.
All commands of this extension can be found by searching for `Blender`.

## Installation

The extension is [installed](https://code.visualstudio.com/docs/editor/extension-gallery) like any other extension in Visual Studio Code.

## Addon Tools

You can develop your addon anywhere, VS Code will create a **permanent soft link** (in windows: junction) to link you workspace:
- for addons to `bpy.utils.user_resource("SCRIPTS", path="addons")`
- for extensions to `bpy.utils.user_resource("EXTENSIONS", path="vscode_development")`
  - VS code installs to local `vscode_development` extensions repository `Blender -> Preferences -> Get Extensions -> Repositories (dropdown, top right)`, see [`blender.addon.extensionsRepository`](vscode://settings/blender.addon.extensionsRepository) 

> [!WARNING]
> In some cases uninstalling addon using Blender Preferences UI interface [might lead to data loss](./EXTENSION-SUPPORT.md#uninstall-addon-and-cleanup)

### How do I create a new addon?

Execute the **Blender: New Addon** operator and use the setup wizard.
You will be asked for the following information:
* Which addon template should be used?
* Where should the addon be created? This should be an empty folder, preferably without spaces or special characters in the name.
* What is the name of the addon?
* What is your name?

### How can I use the extension with my existing addon?

The extension only supports addons that have a folder structure.
If your addon is a single `.py` file, you have to convert it first.
To do this, move the file into a new empty folder and rename it to `__init__.py`.

To use the extension with your addon, just load the addon folder into Visual Studio Code.
Then execute the `Blender: Start` command.
This will ask you for a path to a Blender executable.

Only Blender 2.8.34 onwards is supported.

After you choose a path, Blender will open.
The terminal output can be seen inside of VS Code.
The first time you open a new Blender build like this can take a few seconds longer than usual because some Python libraries are installed automatically.
For that it is important that you have an internet connection.

Once Blender is started, you can use the Addon in Blender.
Debugging should work now.

### Extension support

> With the introduction of Extensions in Blender 4.2, the old way of creating add-ons is considered deprecated.

[Extensions](https://docs.blender.org/manual/en/4.2/advanced/extensions/getting_started.html) are supported.
For migration guide visit [Legacy vs Extension Add-ons](https://docs.blender.org/manual/en/4.2/advanced/extensions/addons.html#legacy-vs-extension-add-ons).
VS code uses the [automatic logic to determine if you are using addon or extension](./EXTENSION-SUPPORT.md)

### How can I reload my addon in Blender?

Execute the `Blender: Reload Addons` command.
For that to work, Blender has to be started using the extension.
Your addon does not need to support reloading itself.
It only has to have correct `register` and `unregister` methods.

To reload the addon every time a file is saved, activate the [`blender.addon.reloadOnSave`](vscode://settings/blender.addon.reloadOnSave) setting in VS Code.

### How can I open blender file automatically when running `Blender: Start`?

Add the path to .blend file to [`blender.additionalArguments`](vscode://settings/blender.additionalArguments):

```javascript
"blender.additionalArguments": [
    "--factory-startup", // any arguments you want
    // "--open-last", // Open the most recently opened blend file, or:
    "./path/to/my-file.blend" // prefered to be last argument, watch out for trailing spaces (which are invisible in VS code UI)
],
```

### How can I separate development environment from my daily work?

By default, Blender started from VS Code uses your global Blender settings (in windows: `%appdata%\Blender Foundation\Blender\<version>`). 

To prevent any accidental changes to your daily setup, change environment var in VS Code setting [`blender.environmentVariables`](vscode://settings/blender.environmentVariables):

```javascript
"blender.environmentVariables": {
    "BLENDER_USER_RESOURCES": "./blender_vscode_development" // changes folder for addons, extensions, modules, config
},
```

See `blender --help` for more environment vars with finer controls: 

```shell
Environment Variables:
  $BLENDER_USER_RESOURCES  Replace default directory of all user files.
                           Other 'BLENDER_USER_*' variables override when set.
  $BLENDER_USER_CONFIG     Directory for user configuration files.
  $BLENDER_USER_SCRIPTS    Directory for user scripts.
  $BLENDER_USER_EXTENSIONS Directory for user extensions.
  $BLENDER_USER_DATAFILES  Directory for user data files (icons, translations, ..).
```

### How to use with multiple addons?

Use VS Code feature [Multi-root Workspaces](https://code.visualstudio.com/docs/editor/multi-root-workspaces). Each folder in workspace is treated as addon root.

### How can I open blender file automatically when running `Blender: Start`?

Add the path to .blend file to `additionalArguments`:

```javascript
"blender.additionalArguments": [
    "--factory-startup", // any arguments you want
    // "--open-last", // Open the most recently opened blend file, or:
    "./path/to/my-file.blend" // prefered to be last argument, watch out for trailing spaces (which are invisible in VS code UI)
],
```

### How can I separate development environment from my daily work?

By default, Blender started from VS Code uses your global Blender settings (in windows: `%appdata%\Blender Foundation\Blender\<version>`). 

To prevent any accidental changes to your daily setup, change environment var in VS Code setting:

```javascript
"blender.environmentVariables": {
    "BLENDER_USER_RESOURCES": "./blender_vscode_development" // changes folder for addons, extensions, modules, config
},
```

See `blender --help` for more environment vars with finer controls: 

```shell
Environment Variables:
  $BLENDER_USER_RESOURCES  Replace default directory of all user files.
                           Other 'BLENDER_USER_*' variables override when set.
  $BLENDER_USER_CONFIG     Directory for user configuration files.
  $BLENDER_USER_SCRIPTS    Directory for user scripts.
  $BLENDER_USER_EXTENSIONS Directory for user extensions.
  $BLENDER_USER_DATAFILES  Directory for user data files (icons, translations, ..).
```

### How to use with multiple addons?

Use VS Code feature [Multi-root Workspaces](https://code.visualstudio.com/docs/editor/multi-root-workspaces). Each folder in workspace is treated as addon root.

## Script Tools

When I say "script" I mean a piece of Python code that runs in Blender but is not an addon.
Scripts are best to test and learn Blender's Python API but also to solve simple tasks at hand.
Usually scripts are written in Blender's text editor.
However, the text editor has fairly limited capabilities compared to modern text editors and IDEs.

For script writing this extension offers
- all text editing features VS Code and its extensions can offer
- a way to quickly organize your scripts into folders
- easy execution of the script inside of Blender
- a simple way to change the context, the script runs in
- debugging

### How can I create a new script?

Execute the `Blender: New Script` command.
You will be asked for a folder to save the script and a script name.
For quick tests you can also just use the given default name.

The new script file already contains a little bit of code to make it easier to get started.

### How can I run the script in Blender?

First you have to start a Blender instance by executing the `Blender: Start` command.
To execute the script in all Blender instances that have been started this way, execute the `Blender: Run Script` command.

### How can I change the context the script runs in?

Currently the support for this is very basic, but still useful.
To run the script in a specific area type in Blender insert a comment like `#context.area: VIEW_3D`.
The preferred way to insert this comment is to execute the `Blender: Set Script Context` command.

### How can I pass command line argument to my script?

Specify your arguments in [`blender.additionalArguments`](vscode://settings/blender.additionalArguments) after `--`, which
 indicates [End option processing, following arguments passed unchanged](https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html). Access via Python’s `sys.argv`

Be aware about:

- [sys.exit gotcha](https://docs.blender.org/api/current/info_gotcha.html#sys-exit) 
- and [register_cli_command](https://docs.blender.org/api/current/bpy.utils.html#bpy.utils.register_cli_command) 

## Core Blender development

This addon has some ability to help with [Blender source code development](https://developer.blender.org/docs/handbook/building_blender/) but it is undocumented.

## Troubleshooting

- Make sure you use the newest version of VS Code.
- Use the latest Blender version from https://www.blender.org/download/.
- Check [CHANGELOG](./CHANGELOG.md) for breaking changes.
- Search Issues for similar problems.
- Look in VS Code output window.

## Status

This extension is not actively developed anymore. However, if you are interested in working on this extension, please contact me.

## Contributing

See [DEVELOPMENT.md](./DEVELOPMENT.md)