'use strict';

import * as vscode from 'vscode';
const path = require('path');
const fs = require('fs');
const http = require('http');
const request = require('request');
const child_process = require('child_process');
const crypto = require('crypto');


let pythonFilesDir = path.join(path.dirname(__dirname), 'pythonFiles');
let templateFilesDir = path.join(pythonFilesDir, 'templates');
let pipPath = path.join(pythonFilesDir, 'get-pip.py');
let CANCEL = 'CANCEL';

let server : any = undefined;
let BLENDER_PORT : number | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
    let commands : [string, () => Promise<void>][] = [
        ['blender.startBlender', COMMAND_startBlender],
        ['blender.newAddon',     COMMAND_newAddon],
        ['blender.launchAddon',  COMMAND_launchAddon],
        ['blender.updateAddon',  COMMAND_updateAddon],
    ];

    let disposables = [
        vscode.workspace.onDidSaveTextDocument(HANDLER_updateOnSave),
        vscode.tasks.onDidEndTask(HANDLER_taskEnds),
    ];

    for (let [identifier, func] of commands) {
        let command = vscode.commands.registerCommand(identifier, handleErrors(func));
        disposables.push(command);
    }

    context.subscriptions.push(...disposables);

    server = http.createServer(SERVER_handleRequest);
    server.listen();
}

export function deactivate() {
    server.close();
}

/* Commands
 *********************************************/

async function COMMAND_startBlender() {
    await startBlender();
}

async function COMMAND_newAddon() {
    let workspaceFolders = getWorkspaceFolders();
    if (workspaceFolders.length === 0) {
        let value = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'New Addon'});
        if (value === undefined) return;
        await tryMakeAddonInFolder(value[0].fsPath, true);
    } else if (workspaceFolders.length === 1) {
        await tryMakeAddonInFolder(workspaceFolders[0].uri.fsPath);
    } else {
        throw new Error('Can\'t create a new addon in a workspace with multiple folders yet.');
    }
}

async function tryMakeAddonInFolder(folderPath : string, openWorkspace : boolean = false) {
    await testIfAddonCanBeCreatedInFolder(folderPath);
    let [addonName, authorName] = await askUser_SettingsForNewAddon();
    await createNewAddon(folderPath, addonName, authorName);
    await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(folderPath));
}

async function COMMAND_launchAddon() {
    try {
        let blenderPath = await tryGetBlenderPath(true);
        await launchAddon(blenderPath, getWorkspaceFolders()[0].uri.fsPath);
    } catch (err) {
        showErrorIfNotCancel(err.message);
    }
}

async function COMMAND_updateAddon(onSuccess : (() => void) | undefined = undefined) {
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

function HANDLER_taskEnds(e : vscode.TaskEndEvent) {
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
            } else if (res.type === 'newOperator') {
                let settings = new OperatorSettings(res.name, res.group);
                insertTemplate_SimpleOperator(settings, showErrorIfNotCancel);
                response.end('OK');
            } else if (res.type === 'newPanel') {
                let settings = new PanelSettings(res.name, res.spaceType, res.regionType, res.group);
                insertTemplate_Panel(settings, showErrorIfNotCancel);
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

async function launchAddon(blenderPath : string, launchDirectory : string) {
    let pyLaunchPath = path.join(pythonFilesDir, 'launch_external.py');

    await startBlender(
        ['--python', pyLaunchPath],
        {
            ADDON_DEV_DIR: launchDirectory,
            DEBUGGER_PORT: server.address().port,
            PIP_PATH: pipPath,
        }
    );
}

async function tryGetBlenderPath(allowAskUser : boolean = true) {
    let config = getConfiguration();
    let blenderPaths = <{path:string, name:string}[]>config.get('blenderPaths');

    if (blenderPaths.length === 0) {
        if (allowAskUser) {
            let blenderPath = await askUser_BlenderPath();
            blenderPaths.push({path:blenderPath, name:path.basename(path.dirname(blenderPath))});
            config.update('blenderPaths', blenderPaths, vscode.ConfigurationTarget.Global);
            return blenderPath;
        }
    } else if (blenderPaths.length === 1) {
        return blenderPaths[0].path;
    } else {
        if (allowAskUser) {
            let names = blenderPaths.map(item => item.name);
            let selectedName = await vscode.window.showQuickPick(names);
            return <string>(<any>blenderPaths.find(item => item.name === selectedName)).path;
        }
    }

    throw new Error('Could not get path to Blender.');
}

async function askUser_SettingsForNewAddon() {
    let addonName = await vscode.window.showInputBox({
        placeHolder: 'Addon Name',
    });
    if (addonName === undefined) {
        throw new Error(CANCEL);
    } else if (addonName === "") {
        throw new Error('Can\'t create an addon without a name.');
    }

    let authorName = await vscode.window.showInputBox({
        placeHolder: 'Your Name',
    });
    if (authorName === undefined) {
        throw new Error(CANCEL);
    } else if (authorName === "") {
        throw new Error('Can\'t create an addon without an author name.');
    }

    return [<string>addonName, <string>authorName];
}

async function askUser_BlenderPath() {
    let value = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: 'Blender Executable'
        });
    if (value === undefined) throw new Error(CANCEL);
    let filepath = value[0].fsPath;
    await testIfPathIsBlender(filepath);
    return filepath;
}

async function createNewAddon(folder : string, addonName : string, authorName : string) {
    let initSourcePath = path.join(templateFilesDir, 'addon.py');
    let initTargetPath = path.join(folder, "__init__.py");
    let text = await readTextFile(initSourcePath);
    text = text.replace('ADDON_NAME', addonName);
    text = text.replace('AUTHOR_NAME', authorName);

    return new Promise<string>((resolve, reject) => {
        fs.writeFile(initTargetPath, text, (err : Error) => {
            if (err !== null) {
                throw new Error('Could not create the __init__.py file.');
            } else {
                resolve(initTargetPath);
            }
        });
    });
}


/* Checking
 ***************************************/

async function testIfPathIsBlender(filepath : string) {
    let name : string = path.basename(filepath);

    if (!name.toLowerCase().startsWith('blender')) {
        throw new Error('Expected executable name to begin with \'blender\'');
    }

    let testString = '###TEST_BLENDER###';
    let command = `${filepath} --factory-startup -b --python-expr "import sys;print('${testString}');sys.stdout.flush();sys.exit()"`;

    return new Promise<void>((resolve, reject) => {
        child_process.exec(command, {},
            (err : Error, stdout : string | Buffer, stderr : string | Buffer) => {
                let text = stdout.toString();
                if (!text.includes(testString)) throw new Error('Path is not Blender.');
                resolve();
            });
    });
}

async function testIfAddonCanBeCreatedInFolder(folder : string) {
    return new Promise<void>((resolve, reject) => {
        fs.stat(folder, (err : Error, stat : any) => {
            if (err !== null) throw new Error('Error when accesing the folder.');
            if (!stat.isDirectory()) throw new Error('Not a directory.');

            fs.readdir(folder, {}, (err : Error, files : string[]) => {
                for (let name of files) {
                    if (!name.startsWith('.')) {
                        throw new Error('The folder already contains some files.');
                    }
                }
                resolve();
            });
        });
    });
}


/* Operator insertion
 **************************************/

class OperatorSettings {
    name : string;
    group : string;

    constructor(name : string, group : string) {
        this.name = name;
        this.group = group;
    }

    getIdName() {
        return `${this.group}.${nameToIdentifier(this.name)}`;
    }

    getClassName() {
        return nameToClassIdentifier(this.name) + 'Operator';
    }
}

async function insertTemplate_SimpleOperator(settings : OperatorSettings, onError : (reason : string) => void) {
    let sourcePath = path.join(templateFilesDir, 'operator_simple.py');
    let text = await readTextFile(sourcePath);
    text = text.replace('LABEL', settings.name);
    text = text.replace('OPERATOR_CLASS', 'bpy.types.Operator');
    text = text.replace('IDNAME', settings.getIdName());
    text = text.replace('CLASS_NAME', settings.getClassName());
    insertTextBlock(text, onError);
}


/* Panel Insertion
**************************************/

class PanelSettings {
    name : string;
    spaceType : string;
    regionType : string;
    group : string;

    constructor(name : string, spaceType : string, regionType : string, group : string) {
        this.name = name;
        this.spaceType = spaceType;
        this.regionType = regionType;
        this.group = group;
    }

    getIdName() {
        return `${this.group}_PT_${nameToIdentifier(this.name)}`;
    }

    getClassName() {
        return nameToClassIdentifier(this.name) + 'Panel';
    }
}

async function insertTemplate_Panel(settings : PanelSettings, onError : (reason : string) => void) {
    let sourcePath = path.join(templateFilesDir, 'panel_simple.py');
    let text = await readTextFile(sourcePath);
    text = text.replace('LABEL', settings.name);
    text = text.replace('PANEL_CLASS', 'bpy.types.Panel');
    text = text.replace('SPACE_TYPE', settings.spaceType);
    text = text.replace('REGION_TYPE', settings.regionType);
    text = text.replace('CLASS_NAME', settings.getClassName());
    text = text.replace('IDNAME', settings.getIdName());
    insertTextBlock(text, onError);
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
    return vscode.workspace.getConfiguration('blender');
}

function readTextFile(path : string) {
    return new Promise<string>((resolve, reject) => {
        fs.readFile(path, 'utf8', (err : Error, data : any) => {
            if (err !== null) {
                throw new Error(`Could not read the file: ${path}`);
            } else {
                resolve(data);
            }
        });
    });
}

async function startBlender(args : string[] = [], additionalEnv : {} = {}) {
    let blenderPath = await tryGetBlenderPath(true);
    return startExternalProgram(blenderPath, args, additionalEnv);
}

async function startExternalProgram(
        command : string, args : string[] = [], additionalEnv : any = {},
        name : string = path.basename(command),
        identifier : any = getRandomString())
{
    let folders = getWorkspaceFolders();
    if (folders.length === 0) throw new Error('workspace required to run an external command');

    let env = Object.assign({}, process.env, additionalEnv);

    let taskDefinition = {type: identifier};
    let target = folders[0];
    let source = 'blender';
    let execution = new vscode.ProcessExecution(command, args, {env:env, });
    let problemMatchers : string[] = [];
    let task = new vscode.Task(taskDefinition, target, name, source, execution, problemMatchers);
    return vscode.tasks.executeTask(task);
}

function getTasksByThisExtension() {
    return vscode.tasks.taskExecutions.filter(task => task.task.source === 'blender');
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

function handleErrors(func : () => Promise<void>) {
    return async () => {
        try {
            await func();
        } catch (err) {
            if (err.message !== CANCEL) {
                vscode.window.showErrorMessage(err.message);
            }
        }
    };
}

function getRandomString(length : number = 10) {
    return crypto.randomBytes(length).toString('hex').substring(0, length);
}