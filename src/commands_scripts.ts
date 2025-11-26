import * as path from 'path';
import * as vscode from 'vscode';
import { RunningBlenders } from './communication';
import { getAreaTypeItems } from './commands_scripts_data_loader';
import { COMMAND_start, outputChannel, StartCommandArguments } from './extension';
import { templateFilesDir } from './paths';
import { letUserPickItem, PickItem } from './select_utils';
import { addFolderToWorkspace, cancel, copyFile, getConfig, getRandomString, pathExists } from './utils';

export function COMMAND_runScript_registerCleanup() {
    const disposableTaskListener = vscode.tasks.onDidEndTaskProcess((e) => {
        if (e.execution.task.source !== 'blender') return;
        const id = e.execution.task.definition.type;
        RunningBlenders.kill(id);
    });
    return [disposableTaskListener];
}

type RunScriptCommandArguments = {
    path?: string; // compatibility with <0.26
} & StartCommandArguments;

export async function COMMAND_runScript(args?: RunScriptCommandArguments): Promise<void> {
    let scriptPath = args?.script ?? args?.path;

    if (!scriptPath) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return Promise.reject(new Error('No active script'));
        const document = editor.document;
        await document.save();
        outputChannel.appendLine(`Blender: Run Script: ${document.uri.fsPath}`);
        scriptPath = document.uri.fsPath;
    }

    const instances = await RunningBlenders.getResponsive();
    if (instances.length > 0) {
        await RunningBlenders.sendToResponsive({ type: 'script', path: scriptPath });
    } else {
        const commandArgs: StartCommandArguments = { script: scriptPath, blenderExecutable: args?.blenderExecutable };
        await COMMAND_start(commandArgs);
    }
}

export async function COMMAND_newScript(): Promise<void> {
    const [folderPath, filePath] = await getPathForNewScript();
    await createNewScriptAtPath(filePath);

    await vscode.window.showTextDocument(vscode.Uri.file(filePath));
    await vscode.commands.executeCommand('cursorBottom');
    addFolderToWorkspace(folderPath);
}

export async function COMMAND_openScriptsFolder(): Promise<void> {
    const folderPath = await getFolderForScripts();
    addFolderToWorkspace(folderPath);
}

export async function COMMAND_setScriptContext(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const items = (await getAreaTypeItems()).map(item => ({ label: item.name, description: item.identifier }));
    const item = await letUserPickItem(items);
    await setScriptContext(editor.document, item.description!);
}

async function setScriptContext(document: vscode.TextDocument, areaType: string): Promise<void> {
    const workspaceEdit = new vscode.WorkspaceEdit();
    const [line, match] = findAreaContextLine(document);

    if (!match) {
        workspaceEdit.insert(document.uri, new vscode.Position(0, 0), `# context.area: ${areaType}\n`);
    } else {
        const start = new vscode.Position(line, match[0].length);
        const end = new vscode.Position(line, document.lineAt(line).range.end.character);
        workspaceEdit.replace(document.uri, new vscode.Range(start, end), areaType);
    }

    await vscode.workspace.applyEdit(workspaceEdit);
}

function findAreaContextLine(document: vscode.TextDocument): [number, RegExpMatchArray | null] {
    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const match = line.text.match(/^\s*#\s*context\.area\s*:\s*/i);
        if (match) return [i, match];
    }
    return [-1, null];
}

async function getPathForNewScript(): Promise<[string, string]> {
    const folderPath = await getFolderForScripts();
    const fileName = await askUser_ScriptFileName(folderPath);
    const filePath = path.join(folderPath, fileName);

    if (await pathExists(filePath)) return Promise.reject(new Error('File exists already'));
    return [folderPath, filePath];
}

async function createNewScriptAtPath(filePath: string): Promise<void> {
    const defaultScriptPath = path.join(templateFilesDir, 'script.py');
    await copyFile(defaultScriptPath, filePath);
}

export interface ScriptFolderData {
    path: string;
    name: string;
}

async function getFolderForScripts(): Promise<string> {
    const scriptFolders = getStoredScriptFolders();

    const items: PickItem[] = scriptFolders.map(folderData => ({
        label: folderData.name || folderData.path,
        data: async () => folderData
    }));

    items.push({ label: 'New Folder...', data: askUser_ScriptFolder });

    const pickedItem = await letUserPickItem(items);
    const folderData: ScriptFolderData = await pickedItem.data();

    if (!scriptFolders.find(data => data.path === folderData.path)) {
        scriptFolders.push(folderData);
        const config = getConfig();
        config.update('scripts.directories', scriptFolders, vscode.ConfigurationTarget.Global);
    }

    return folderData.path;
}

export function getStoredScriptFolders(): ScriptFolderData[] {
    const config = getConfig();
    return config.get('scripts.directories') ?? [];
}

async function askUser_ScriptFolder(): Promise<ScriptFolderData> {
    const value = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Script Folder'
    });
    if (!value) return Promise.reject(cancel());
    return { path: value[0].fsPath, name: '' };
}

async function askUser_ScriptFileName(folder: string): Promise<string> {
    const defaultName = await getDefaultScriptName(folder);
    let name = await vscode.window.showInputBox({ value: defaultName });
    if (!name) return Promise.reject(cancel());
    if (!name.toLowerCase().endsWith('.py')) name += '.py';
    return name;
}

async function getDefaultScriptName(folder: string): Promise<string> {
    while (true) {
        const name = 'script ' + getRandomString(10) + '.py';
        if (!(await pathExists(path.join(folder, name)))) return name;
    }
}
