import * as vscode from 'vscode';
import * as path from 'path';
import { templateFilesDir } from './paths';
import { BlenderInstance, RunningBlenders } from './communication';
import { letUserPickItem, PickItem } from './select_utils';
import { getAreaTypeItems } from './data_loader';
import { getConfig, cancel, addFolderToWorkspace, getRandomString, pathExists, copyFile } from './utils';
import { COMMAND_start, outputChannel } from './extension';
import { BlenderPathData } from './blender_executable';

export async function COMMAND_runScript(): Promise<void> {
    let editor = vscode.window.activeTextEditor;
    if (editor === undefined) return Promise.reject(new Error('no active script'));

    const document = editor.document;
    outputChannel.appendLine(`Blender: Run Script: ${document.uri.fsPath}`)
    await document.save();
    const activeInstances = await RunningBlenders.getResponsive();
    if (activeInstances.length !== 0) {
        RunningBlenders.sendToResponsive({ type: 'script', path: document.uri.fsPath })
        return
    }
    const config = getConfig();
    const defaultSettings = (<BlenderPathData[]>config.get('executables')).filter(item => item.isBlenderRunScriptDefault === true);
    RunningBlenders.onRegisterCallOnce((instance: BlenderInstance) => RunningBlenders.sendToResponsive({ type: 'script', path: document.uri.fsPath }))
    const blenderTask = await COMMAND_start(defaultSettings.length === 0 ? undefined : defaultSettings[0])
    if (blenderTask === undefined)
        throw new Error("Starting blender failed")
}


export async function COMMAND_newScript(): Promise<void> {
    let [folderPath, filePath] = await getPathForNewScript();
    await createNewScriptAtPath(filePath);

    await vscode.window.showTextDocument(vscode.Uri.file(filePath));
    await vscode.commands.executeCommand('cursorBottom');
    addFolderToWorkspace(folderPath);
}

export async function COMMAND_openScriptsFolder() {
    let folderPath = await getFolderForScripts();
    addFolderToWorkspace(folderPath);
}

export async function COMMAND_setScriptContext() {
    let editor = vscode.window.activeTextEditor;
    if (editor === undefined) return;

    let items = (await getAreaTypeItems()).map(item => ({ label: item.name, description: item.identifier }));
    let item = await letUserPickItem(items);
    await setScriptContext(editor.document, <string>item.description);
}

async function setScriptContext(document: vscode.TextDocument, areaType: string): Promise<void> {
    let workspaceEdit = new vscode.WorkspaceEdit();
    let [line, match] = findAreaContextLine(document);
    if (match === null) {
        workspaceEdit.insert(document.uri, new vscode.Position(0, 0), `# context.area: ${areaType}\n`);
    }
    else {
        let start = new vscode.Position(line, match[0].length);
        let end = new vscode.Position(line, document.lineAt(line).range.end.character);
        let range = new vscode.Range(start, end);
        workspaceEdit.replace(document.uri, range, areaType);
    }
    await vscode.workspace.applyEdit(workspaceEdit);
}

function findAreaContextLine(document: vscode.TextDocument): [number, RegExpMatchArray | null] {
    for (let i = 0; i < document.lineCount; i++) {
        let line = document.lineAt(i);
        let match = line.text.match(/^\s*#\s*context\.area\s*:\s*/i);
        if (match !== null) {
            return [i, match];
        }
    }
    return [-1, null];
}

async function getPathForNewScript() {
    let folderPath = await getFolderForScripts();
    let fileName = await askUser_ScriptFileName(folderPath);
    let filePath = path.join(folderPath, fileName);

    if (await pathExists(filePath)) {
        return Promise.reject(new Error('file exists already'));
    }

    return [folderPath, filePath];
}

async function createNewScriptAtPath(filePath: string) {
    let defaultScriptPath = path.join(templateFilesDir, 'script.py');
    await copyFile(defaultScriptPath, filePath);
}

export interface ScriptFolderData {
    path: string;
    name: string;
}

async function getFolderForScripts() {
    let scriptFolders = getStoredScriptFolders();

    let items: PickItem[] = [];
    for (let folderData of scriptFolders) {
        let useCustomName = folderData.name !== '';
        items.push({
            label: useCustomName ? folderData.name : folderData.path,
            data: async () => folderData,
        });
    }

    items.push({
        label: 'New Folder...',
        data: askUser_ScriptFolder,
    });

    let item = await letUserPickItem(items);
    let folderData: ScriptFolderData = await item.data();

    if (scriptFolders.find(data => data.path === folderData.path) === undefined) {
        scriptFolders.push(folderData);
        let config = getConfig();
        config.update('scripts.directories', scriptFolders, vscode.ConfigurationTarget.Global);
    }

    return folderData.path;
}

export function getStoredScriptFolders() {
    let config = getConfig();
    return <ScriptFolderData[]>config.get('scripts.directories');
}

async function askUser_ScriptFolder(): Promise<ScriptFolderData> {
    let value = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Script Folder'
    });
    if (value === undefined) return Promise.reject(cancel());
    return {
        path: value[0].fsPath,
        name: ''
    };
}

async function askUser_ScriptFileName(folder: string): Promise<string> {
    let defaultName = await getDefaultScriptName(folder);
    let name = await vscode.window.showInputBox({
        value: defaultName
    });
    if (name === undefined) return Promise.reject(cancel());
    if (!name.toLowerCase().endsWith('.py')) {
        name += '.py';
    }
    return name;
}

async function getDefaultScriptName(folder: string) {
    while (true) {
        let name = 'script ' + getRandomString(10) + '.py';
        if (!(await pathExists(path.join(folder, name)))) {
            return name;
        }
    }
}
