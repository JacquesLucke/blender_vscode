'use strict';

import * as vscode from 'vscode';
var path = require('path');
var fs = require('fs');
const { exec, spawn } = require('child_process');

let pythonFilesDir = path.join(path.dirname(__dirname), 'pythonFiles');
let CANCEL = 'CANCEL';

export function activate(context: vscode.ExtensionContext) {
    let disposables = [
        vscode.commands.registerCommand('b3ddev.startBlender', COMMAND_startBlender),
        vscode.commands.registerCommand('b3ddev.newAddon', COMMAND_newAddon),
        vscode.commands.registerCommand('b3ddev.launchAddon', COMMAND_launchAddon),
    ];

    context.subscriptions.push(...disposables);
}

export function deactivate() {
}

function COMMAND_startBlender() {
    tryGetBlenderPath(true, blenderPath => {
        exec(blenderPath);
    }, showErrorIfNotCancel);
}

function COMMAND_newAddon() {
    tryDeriveFolderForNewAddon(folder => {
        askUser_SettingsForNewAddon((addonName, authorName) => {
            createNewAddon(folder, addonName, authorName);
        }, showErrorIfNotCancel);
    }, showErrorIfNotCancel);
}

function COMMAND_launchAddon() {
    tryGetBlenderPath(true, blenderPath => {
        tryGetAddonStructureType(launchType => {
            if (launchType === 'single') {
                launch_Single_External(blenderPath, (<vscode.WorkspaceFolder[]>vscode.workspace.workspaceFolders)[0].uri.path);
            }
        }, showErrorIfNotCancel);
    }, showErrorIfNotCancel);
}

function launch_Single_External(blenderPath : string, launch_directory : string) {
    let pyLaunchPath = path.join(pythonFilesDir, 'launch_external.py');
    let env : any = new Object(process.env);
    env['ADDON_DEV_DIR'] = launch_directory;
    spawn('gnome-terminal', ['-x', blenderPath, '--python', pyLaunchPath], {env:env});
}

function showErrorIfNotCancel(message : string) {
    if (message !== CANCEL) {
        vscode.window.showErrorMessage(message);
    }
}

function tryGetAddonStructureType(onSuccess : (launchType : string) => void, onError : (reason : string) => void) {
    onSuccess('single');
}

function tryGetBlenderPath(allowAskUser : boolean, onSuccess : (path : string) => void, onError : (reason : string) => void) {
    let config = getConfiguration();
    let savedBlenderPath = config.get('blenderPath');

    if (savedBlenderPath !== undefined && savedBlenderPath !== "") {
        onSuccess(<string>savedBlenderPath);
    } else {
        if (allowAskUser) {
            askUser_BlenderPath(onSuccess, onError);
        } else {
            onError('Could not get path to Blender.');
        }
    }
}

function tryDeriveFolderForNewAddon(onSuccess : (folderpath : string) => void, onError : (reason : string) => void) {
    let workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders === undefined) {
        onError('No empty folder open.');
        return;
    }
    if (workspaceFolders.length !== 1) {
        onError('Multiple workspace folder are open.');
    }

    let folder = workspaceFolders[0].uri.path;
    canAddonBeCreatedInFolder(folder, canBeCreated => {
        if (canBeCreated) onSuccess(folder);
        else {
            onError('The folder already has an __init__.py file.');
        }
    });
}

function askUser_SettingsForNewAddon(onSuccess : (addonName : string, authorName : string) => void, onError : (reason : string) => void) {
    vscode.window.showInputBox({
        placeHolder: 'Addon Name (can be changed later)',
    }).then(addonName => {
        if (addonName === undefined) {
            onError(CANCEL);
        } else if (addonName === "") {
            onError('Can\'t create an addon without a name.');
            return;
        }

        vscode.window.showInputBox({
            placeHolder: 'Your Name (can be changed later)',
        }).then(authorName => {
            if (authorName === undefined) {
                onError(CANCEL);
            } else if (authorName === "") {
                onError('Can\'t create an addon without an author name.');
            } else {
                onSuccess(<string>addonName, <string>authorName);
            }
        });
    });
}

function canAddonBeCreatedInFolder(folder : string, callback : (canBeCreated : boolean) => void) {
    let initPath = path.join(folder, '__init__.py');
    fs.stat(initPath, (err : Error, stat : any) => {
        callback(err !== null);
    });
}

function createNewAddon(folder : string, addonName : string, authorName : string) {
    let initSourcePath = path.join(pythonFilesDir, 'addon_template.py');
    let initTargetPath = path.join(folder, "__init__.py");
    fs.readFile(initSourcePath, 'utf8', (err : Error, data : any) => {
        if (err !== null) {
            vscode.window.showErrorMessage('Could not read the template file.');
            return;
        }
        let text : string = data;
        text = text.replace('ADDON_NAME', addonName);
        text = text.replace('AUTHOR_NAME', authorName);

        fs.writeFile(initTargetPath, text, (err : Error) => {
            if (err !== null) {
                vscode.window.showErrorMessage('Could not creat the __init__.py file.');
                return;
            }
            vscode.workspace.openTextDocument(initTargetPath).then(document => {
                vscode.window.showTextDocument(document);
            });
        });
    });
}

function getConfiguration() {
    return vscode.workspace.getConfiguration('b3ddev');
}

function testIfPathIsBlender(filepath : string, callback : (isValid : boolean) => void) {
    let name : string = path.basename(filepath);

    if (name.toLowerCase().startsWith('blender')) {
        let testString = '###TEST_BLENDER###';
        exec(`${filepath} -b --python-expr "import sys;print('${testString}');sys.stdout.flush();sys.exit()"`, {},
            (err : Error, stdout : string | Buffer, stderr : string | Buffer) => {
                let text = stdout.toString();
                callback(text.includes(testString));
            });
    } else {
        callback(false);
    }
}

function askUser_BlenderPath(onSuccess : (path : string) => void, onError : (reason : string) => void) {
    vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: 'Blender Executable'
    }).then(value => {
        if (value === undefined) {
            onError(CANCEL);
            return;
        }
        let filepath = value[0].path;
        testIfPathIsBlender(filepath, is_valid => {
            if (is_valid) {
                getConfiguration().update('blenderPath', filepath);
                onSuccess(filepath);
            } else {
                onError('Selected file is not a valid Blender executable.');
            }
        });
    });
}

// function tryGetAddonsDirectory(blenderPath : string, onSuccess : (path : string) => void, onError : (reason : string) => void) {
//     let config = getConfiguration();
//     let savedAddonDir = config.get('addonDirectory');

//     if (savedAddonDir === undefined || savedAddonDir === "") {
//         getAddonsDirectoryFromBlender(blenderPath, path => {
//             config.update('addonsDirectory', path);
//             onSuccess(path);
//         }, onError);
//     } else {
//         onSuccess(<string>savedAddonDir);
//     }
// }

function getAddonsDirectoryFromBlender(blenderPath : string, onSuccess : (path : string) => void, onError : (reason : string) => void) {
    let sep = "###SEP###";
    let lines = [
        "import sys, bpy",
        `print('${sep}' + bpy.utils.user_resource('SCRIPTS', 'addons') + '${sep}')`,
        "sys.stdout.flush()",
        "sys.exit()",
    ];

    let expression = lines.join('\n');

    exec(`${blenderPath} -b --python-expr "${expression}"`, {},
    (err : Error, stdout : string | Buffer, stderr : string | Buffer) => {
        if (err === null) {
            let text = stdout.toString();
            let addonsPath = text.split(sep)[1];
            onSuccess(addonsPath);
        } else {
            onError(CANCEL);
        }
    });
}