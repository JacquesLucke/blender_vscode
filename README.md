!!! still work in progress, a more stable version will be published soon !!!

# Blender Development in VS Code

The only key combination you have to remember is `ctrl+shift+P`.
All commands of this extension can be found by searching for `Blender`.

## Installation

The extension is [installed](https://code.visualstudio.com/docs/editor/extension-gallery) like any other extension in Visual Studio Code.

## How do I create a new addon?

Execute the **Blender: New Addon** operator and use the setup wizard.
You will be asked for the following information:
* Where should the addon be created?
* Name of the addon.
* Your name.

## How can I use the extension with my existing addon?

The extension only supports addons that have a folder structure.
If your addon is a single `.py` file, you have to convert it first.
To do this, move the file into a new empty folder and rename it to `__init__.py`.

To use the extension with your addon, just load the addon folder into Visual Studio Code.
Then execute the `Blender: Start` command.
This will ask you for a path to a Blender executable.
Only Blender 2.8 is supported.

After you choosed a path, Blender will open.
The terminal output can be seen inside of VS Code.
The first time you open a new Blender build like this can take a few seconds longer than usual because some Python libraries are installed automatically.
For that it is important that you have an internet connection.

Once Blender is started, you can use the Addon in Blender.
Debugging should work now.

If the selected Blender executable does not use its own Python version, no packages will be installed by default.
This is to make sure that the extension does not interfere with another package manager.
You can either install the modules listed in the error message manually, or allow the extension to install the modules itself.
To do that, the `blender.allowModifyExternalPython` [setting](https://code.visualstudio.com/docs/getstarted/settings) has to be checked in VS Code.

## How can I reload my Addon in Blender?

Execute the `Blender: Reload Addons` command.
For that to work, Blender has to be started using the extension.
Your addon does not need to support reloading itself.
It only has to have correct `register` and `unregister` methods.

To reload the addon every time a file is saved, active the `blender.addon.reloadOnSave` setting in VS Code.


## Future

- Polish the features I already started working but are not documented here yet.
- Auto-complete for Blender modules.
- Multiple addon templates (most importantly with auto registration of classes).
- Well integrated snippets.
- ...

Some help from other developers would be very welcome.
Please contact me if you want to help or just make a pull request.
