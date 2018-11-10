'use strict';

import * as vscode from 'vscode';
import { ECANCELED } from 'constants';
var path = require('path');
var fs = require('fs');
const { exec } = require('child_process');

let pythonFilesDir = path.join(path.dirname(__dirname), "pythonFiles");

export function activate(context: vscode.ExtensionContext) {
    let disposables = [
        vscode.commands.registerCommand('b3ddev.startBlender', COMMAND_startBlender),
        vscode.commands.registerCommand('b3ddev.newAddon', COMMAND_newAddon),
    ];

    context.subscriptions.push(...disposables);
}

export function deactivate() {
}

function COMMAND_startBlender() {
    findAndUpdateBlenderPath(blenderPath => {
        //tryFindAddonsDirectory(blenderPath, console.log);
        exec(blenderPath);
    });
}

function COMMAND_newAddon() {
    getFolderForNewAddon(folder => {
        getSettingsForNewAddon((addonName, authorName) => {
            createNewAddon(folder, addonName, authorName);
        });
    });
}

function getFolderForNewAddon(callback : (folderpath : string) => void) {
    let workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders === undefined) {
        vscode.window.showWarningMessage('No empty folder open.');
        return;
    }
    if (workspaceFolders.length !== 1) {
        vscode.window.showWarningMessage('Multiple workspace folder are open.');
    }

    let folder = workspaceFolders[0].uri.path;
    canAddonBeCreatedInFolder(folder, canBeCreated => {
        if (canBeCreated) callback(folder);
        else {
            vscode.window.showErrorMessage("The folder already has a __init__.py file.");
        }
    });
}

function getSettingsForNewAddon(callback : (addonName : string, authorName : string) => void) {
    vscode.window.showInputBox({
        placeHolder: 'Addon Name (can be changed later)',
    }).then(addonName => {
        if (addonName === undefined) return;
        if (addonName === "") {
            vscode.window.showWarningMessage('Can\'t create an addon without a name.');
            return;
        }

        vscode.window.showInputBox({
            placeHolder: 'Your Name (can be changed later)',
        }).then(authorName => {
            if (authorName === undefined) return;
            if (authorName === "") {
                vscode.window.showWarningMessage('Can\'t create an addon without an author name.');
                return;
            }

            callback(addonName, authorName);
        });
    });
}

function canAddonBeCreatedInFolder(folder : string, callback : (canBeCreated : boolean) => void) {
    let initPath = path.join(folder, "__init__.py");
    fs.stat(initPath, (err : Error, stat : any) => {
        callback(err !== null);
    });
}

function createNewAddon(folder : string, addonName : string, authorName : string) {
    let initSourcePath = path.join(pythonFilesDir, "addon_template.py");
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

function getConfigBlenderPath() {
    return getConfiguration().get('blenderPath');
}

function setConfigBlenderPath(path : string) {
    getConfiguration().update('blenderPath', path);
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

function findAndUpdateBlenderPath(whenFound : (path : string) => void) {
    let originalPath = getConfigBlenderPath();
    fs.stat(originalPath, (err: Error, stat: any) => {
        if (err === null && typeof originalPath === 'string') {
            whenFound(originalPath);
        } else {
            vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                openLabel: 'Blender Executable'
            }).then(value => {
                if (value !== undefined) {
                    let filepath = value[0].path;
                    testIfPathIsBlender(filepath, is_valid => {
                        if (is_valid) {
                            setConfigBlenderPath(filepath);
                            whenFound(filepath);
                        } else {
                            vscode.window.showErrorMessage('Not a valid Blender executable.');
                        }
                    });
                }
            });

        }
    });
}

function tryFindAddonsDirectory(blenderPath : string, callback : (path : string | undefined) => void) {
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
            callback(addonsPath);
        } else {
            callback(undefined);
        }
    });
}