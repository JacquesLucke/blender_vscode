'use strict';

import * as vscode from 'vscode';
var path = require('path');
var fs = require('fs');
var http = require('http');
var request = require('request');
const { exec, spawn } = require('child_process');

let pythonFilesDir = path.join(path.dirname(__dirname), 'pythonFiles');
let templateFilesDir = path.join(pythonFilesDir, 'templates');
let pipPath = path.join(pythonFilesDir, 'get-pip.py');
let CANCEL = 'CANCEL';

let SERVER_PORT = 6000;
let BLENDER_PORT : number | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
    let disposables = [
        vscode.commands.registerCommand('b3ddev.startBlender', COMMAND_startBlender),
        vscode.commands.registerCommand('b3ddev.newAddon', COMMAND_newAddon),
        vscode.commands.registerCommand('b3ddev.launchAddon', COMMAND_launchAddon),
        vscode.commands.registerCommand('b3ddev.updateAddon', COMMAND_updateAddon),
        vscode.workspace.onDidSaveTextDocument(HANDLER_updateOnSave),
    ];

    context.subscriptions.push(...disposables);

    let server = http.createServer(SERVER_handleRequest);
    server.listen(SERVER_PORT);
}

export function deactivate() {
}

/* Commands
 *********************************************/

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
        launch_Single_External(blenderPath, (<vscode.WorkspaceFolder[]>vscode.workspace.workspaceFolders)[0].uri.path);
    }, showErrorIfNotCancel);

}

function COMMAND_updateAddon(onSuccess : (() => void) | undefined = undefined) {
    vscode.workspace.saveAll(false);
    request.post(
        `http://localhost:${BLENDER_PORT}`,
        {json: {type: 'update'}},
        function (err : any, response : any, body : any) {
            if (err === null && onSuccess !== undefined) onSuccess();
        }
    );
}

/* Event Handlers
 ***************************************/

function HANDLER_updateOnSave(document : vscode.TextDocument) {
    if (getConfiguration().get('updateOnSave')) {
        COMMAND_updateAddon(() => {
            vscode.window.showInformationMessage("Addon Updated");
        });
    }
}


/* Server
 ***************************************/

function SERVER_handleRequest(request : any, response : any) {
    console.log(request);
    if (request.method === 'POST') {
        let body = '';
        request.on('data', (chunk : any) => body += chunk.toString());
        request.on('end', () => {
            let res = JSON.parse(body);
            if (res.type === 'setup') {
                BLENDER_PORT = res.blenderPort;
                startPythonDebugging(res.debugPort);
                response.end('OK');
            } else if (res.type == 'newOperator') {
                let settings = new OperatorSettings(res.name, res.category);
                insertTemplate_SimpleOperator(settings, showErrorIfNotCancel);
                response.end('OK');
            }
        });
    }
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

function launch_Single_External(blenderPath : string, launchDirectory : string) {
    let pyLaunchPath = path.join(pythonFilesDir, 'launch_external.py');
    runExternalCommand(blenderPath, ['--python', pyLaunchPath], {
        ADDON_DEV_DIR: launchDirectory,
        DEBUGGER_PORT: SERVER_PORT,
        PIP_PATH: pipPath,
    });
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

function createNewAddon(folder : string, addonName : string, authorName : string, onSuccess : (mainPath : string) => void) {
    let initSourcePath = path.join(templateFilesDir, 'addon.py');
    let initTargetPath = path.join(folder, "__init__.py");
    readTextFile(initSourcePath, text => {
        text = text.replace('ADDON_NAME', addonName);
        text = text.replace('AUTHOR_NAME', authorName);

        fs.writeFile(initTargetPath, text, (err : Error) => {
            if (err !== null) {
                vscode.window.showErrorMessage('Could not create the __init__.py file.');
                return;
            }
            onSuccess(initTargetPath);
        });
    }, showErrorIfNotCancel);
}


/* Checking
 ***************************************/

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


/* Operator insertion
 **************************************/

class OperatorSettings {
    name : string;
    category : string;

    constructor(name : string, category : string) {
        this.name = name;
        this.category = category;
    }

    getIdName() {
        return `${this.category}.${nameToIdentifier(this.name)}`;
    }

    getClassName() {
        return nameToClassIdentifier(this.name) + 'Operator';
    }
}

function insertTemplate_SimpleOperator(settings : OperatorSettings, onError : (reason : string) => void) {
    let editor = vscode.window.activeTextEditor;

    if (editor === undefined) {
        onError('No active text editor.');
        return;
    }

    let sourcePath = path.join(templateFilesDir, 'operator_simple.py');
    readTextFile(sourcePath, text => {
        text = text.replace('LABEL', settings.name)
        text = text.replace('OPERATOR_CLASS', 'bpy.types.Operator');
        text = text.replace('IDNAME', settings.getIdName());
        text = text.replace('CLASS_NAME', settings.getClassName())
        insertTextBlock(text, onError);
    }, onError);
}


/* Text Block insertion
 **************************************/

function insertTextBlock(text : string, onError : (reason : string) => void) {
    let editor = vscode.window.activeTextEditor;

    if (editor === undefined) {
        onError('No active text editor.');
        return;
    }

    let endLine = findNextLineStartingInTheBeginning(editor.document, editor.selection.start.line + 1);
    let startLine = findLastLineContainingText(editor.document, endLine - 1);

    let position = new vscode.Position(startLine, editor.document.lineAt(startLine).text.length);
    let range = new vscode.Range(position, position);

    let textEdit = new vscode.TextEdit(range, '\n\n\n' + text);
    let workspaceEdit = new vscode.WorkspaceEdit();
    workspaceEdit.set(editor.document.uri, [textEdit]);
    vscode.workspace.applyEdit(workspaceEdit);
}

function findNextLineStartingInTheBeginning(document : vscode.TextDocument, start : number) : number {
    for (let i = start; i < document.lineCount; i++) {
        let line = document.lineAt(i);
        if (line.text.length > 0 &&line.firstNonWhitespaceCharacterIndex === 0) {
            return i;
        }
    }
    return document.lineCount;
}

function findLastLineContainingText(document : vscode.TextDocument, start : number ) : number {
    for (let i = start; i >= 0; i--) {
        let line = document.lineAt(i);
        if (!line.isEmptyOrWhitespace) {
            return i;
        }
    }
    return 0;
}


/* Utilities
 *******************************************/

function nameToIdentifier(name : string) {
    return name.toLowerCase().replace(/\W+/, '_');
}

function nameToClassIdentifier(name : string) {
    let parts = name.split(/\W+/);
    let result = '';
    let allowNumber = false;
    for (let part of parts) {
        if (part.length > 0 && (allowNumber || !startsWithNumber(part))) {
            result += part.charAt(0).toUpperCase() + part.slice(1);
            allowNumber = true;
        }
    }
    return result;
}

function startsWithNumber(text : string) {
    return text.charAt(0).match(/[0-9]/) !== null;
}

function getConfiguration() {
    return vscode.workspace.getConfiguration('b3ddev');
}

function readTextFile(path : string, onSuccess : (text : string) => void, onError : (reason : string) => void) {
    fs.readFile(path, 'utf8', (err : Error, data : any) => {
        if (err != null) {
            onError(`Could not read the file: ${path}`);
            return;
        }

        onSuccess(data);
    });
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