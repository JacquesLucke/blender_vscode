# Blender Development in VS Code

The only key combination you have to remember is `ctrl+shift+P`.
All commands of this extension can be found by searching for `Blender`.

## Installation

The extension is [installed](https://code.visualstudio.com/docs/editor/extension-gallery) like any other extension in Visual Studio Code.

## Addon Tools

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
Only Blender 2.8 is supported.

After you choose a path, Blender will open.
The terminal output can be seen inside of VS Code.
The first time you open a new Blender build like this can take a few seconds longer than usual because some Python libraries are installed automatically.
For that it is important that you have an internet connection.

Once Blender is started, you can use the Addon in Blender.
Debugging should work now.

If the selected Blender executable does not use its own Python version, no packages will be installed by default.
This is to make sure that the extension does not interfere with another package manager.
You can either install the modules listed in the error message manually, or allow the extension to install the modules itself.
To do that, the `blender.allowModifyExternalPython` [setting](https://code.visualstudio.com/docs/getstarted/settings) has to be checked in VS Code.

### How can I reload my addon in Blender?

Execute the `Blender: Reload Addons` command.
For that to work, Blender has to be started using the extension.
Your addon does not need to support reloading itself.
It only has to have correct `register` and `unregister` methods.

To reload the addon every time a file is saved, activate the `blender.addon.reloadOnSave` setting in VS Code.

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

## Troubleshooting

- Make sure you use the newest version of VS Code.
- Use the latest Blender version from https://builder.blender.org/.
- If your Blender does not use its own Python version, enable `blender.allowModifyExternalPython` or install the packages in the error message manually (currently `debugpy`, `flask` and `requests` are required).

## Status

This extension is not actively developed anymore. However, if you are interested in working on this extension, please contact me.
