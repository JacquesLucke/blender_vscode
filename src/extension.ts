'use strict';

import * as vscode from 'vscode';
var path = require('path');
var fs = require('fs');
var http = require('http');
var request = require('request');
const { exec, spawn } = require('child_process');

let pythonFilesDir = path.join(path.dirname(__dirname), 'pythonFiles');
let CANCEL = 'CANCEL';

let SERVER_PORT = 6000;
let BLENDER_PORT : number | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
    let disposables = [
        vscode.commands.registerCommand('b3ddev.startBlender', COMMAND_startBlender),
        vscode.commands.registerCommand('b3ddev.newAddon', COMMAND_newAddon),
        vscode.commands.registerCommand('b3ddev.launchAddon', COMMAND_launchAddon),
        vscode.commands.registerCommand('b3ddev.setupPythonDebugging', COMMAND_setupPythonDebugging),
        vscode.commands.registerCommand('b3ddev.updateAddon', COMMAND_updateAddon),
    ];

    context.subscriptions.push(...disposables);

    let server = http.createServer(SERVER_handleRequest);
    server.listen(SERVER_PORT);
}

export function deactivate() {
}

function COMMAND_startBlender() {
    tryGetBlenderPath(true, blenderPath => {
        exec(blenderPath);
    }, showErrorIfNotCancel);
}

function COMMAND_newAddon() {
    let workspaceFolders = getWorkspaceFolders();
    if (workspaceFolders.length == 0) {
        vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'New Addon'
        }).then(value => {
            if (value === undefined) return;
            tryMakeAddonInFolder(value[0].path, true);
        });
    } else if (workspaceFolders.length == 1) {
        tryMakeAddonInFolder(workspaceFolders[0].uri.path);
    } else {
        vscode.window.showErrorMessage('Can\'t create a new addon in a workspace with multiple folders yet.');
    }

    function tryMakeAddonInFolder(folderPath : string, openWorkspace : boolean = false) {
        canAddonBeCreatedInFolder(folderPath, () => {
            askUser_SettingsForNewAddon((addonName, authorName) => {
                createNewAddon(folderPath, addonName, authorName, mainPath => {
                    if (openWorkspace) {
                        /* Extension will automatically be restarted after this. */
                        vscode.workspace.updateWorkspaceFolders(0, null, {uri: vscode.Uri.file(folderPath), name: addonName});
                    } else {
                        vscode.workspace.openTextDocument(mainPath).then(document => {
                            vscode.window.showTextDocument(document);
                        });
                    }
                });
            }, showErrorIfNotCancel);
        }, showErrorIfNotCancel);
    }
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

function COMMAND_setupPythonDebugging() {
    tryGetBlenderPath(true, blenderPath => {
        installModulesForDebugging(blenderPath);
    }, showErrorIfNotCancel);
}

function COMMAND_updateAddon() {
    vscode.workspace.saveAll(false);
    request.post(
        `http://localhost:${BLENDER_PORT}`,
        {json: {type: 'UPDATE_ADDON'}},
        function (err : any, response : any, body : any) {

        }
    );
}

function startPythonDebugging(port : number) {
    let configuration = {
        name: "Debug Python in Blender",
        request: "attach",
        type: "python",
        port: port,
        host: "localhost"
    };
    vscode.debug.startDebugging(undefined, configuration);
}

function SERVER_handleRequest(request : any, response : any) {
    console.log(request);
    if (request.method === 'POST') {
        let body = '';
        request.on('data', (chunk : any) => body += chunk.toString());
        request.on('end', () => {
            let res = JSON.parse(body);
            if (res.type === 'WAIT_FOR_ATTACH') {
                startPythonDebugging(res.port);
                response.end('OK');
            }
            if (res.type === 'SET_PORT') {
                BLENDER_PORT = res.port;
                response.end('OK');
            }
        });
    }
}

function launch_Single_External(blenderPath : string, launchDirectory : string) {
    let pyLaunchPath = path.join(pythonFilesDir, 'launch_external.py');
    runExternalCommand(blenderPath, ['--python', pyLaunchPath], {
        ADDON_DEV_DIR: launchDirectory,
        DEBUGGER_PORT: SERVER_PORT,
    });
}

function installModulesForDebugging(blenderPath : string) {
    let setupDebuggingPath = path.join(pythonFilesDir, 'setup_debugging.py');
    let getPipPath = path.join(pythonFilesDir, 'get-pip.py');
    runExternalCommand(blenderPath, ['-b', '--python', setupDebuggingPath], {GET_PIP_PATH:getPipPath});
}

function runExternalCommand(command : string, args : string[], additionalEnv : any = {}) {
    let env = Object.assign({}, process.env, additionalEnv);
    let config = vscode.workspace.getConfiguration('terminal.external');
    if (process.platform === 'linux') {
        spawn(config.get('linuxExec'), ['-e', command, ...args], {env:env});
    } else if (process.platform == 'win32') {
        spawn('start', [command, ...args], {env:env})
    }
}

function showErrorIfNotCancel(message : string) {
    if (message !== CANCEL) {
        vscode.window.showErrorMessage(message);
    }
}

function getWorkspaceFolders() {
    let folders = vscode.workspace.workspaceFolders;
    if (folders === undefined) return [];
    else return folders;
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

function canAddonBeCreatedInFolder(folder : string, onSuccess : () => void, onError : (reason : string) => void) {
    fs.stat(folder, (err : Error, stat : any) => {
        if (err !== null) onError('Error when accesing the folder.');
        if (!stat.isDirectory()) onError('Not a directory.');

        fs.readdir(folder, {}, (err : Error, files : string[]) => {
            for (let name of files) {
                if (!name.startsWith('.')) {
                    onError('The folder already contains some files.');
                    return;
                }
            }
            onSuccess();
        });
    });
}

function createNewAddon(folder : string, addonName : string, authorName : string, onSuccess : (mainPath : string) => void) {
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
            onSuccess(initTargetPath);
        });
    });
}

function getConfiguration() {
    return vscode.workspace.getConfiguration('b3ddev');
}

function testIfPathIsBlender(filepath : string, callback : (isValid : boolean) => void) {
    let name : string = path.basename(filepath);

    if (name.toLowerCase().startsWith('blender')) {
        /* not starting in background because some addons might
         * crash Blender before the expression is executed */
        let testString = '###TEST_BLENDER###';
        let command = `${filepath} --python-expr "import sys;print('${testString}');sys.stdout.flush();sys.exit()"`;
        exec(command, {},
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