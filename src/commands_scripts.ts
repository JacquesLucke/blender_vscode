import * as path from 'path';
import * as vscode from 'vscode';
import { RunningBlenders } from './communication';
import { getAreaTypeItems } from './commands_scripts_data_loader';
import { COMMAND_start, outputChannel, StartCommandArguments } from './extension';
import { templateFilesDir } from './paths';
import { letUserPickItem, PickItem } from './select_utils';
import { addFolderToWorkspace, cancel, copyFile, getConfig, getRandomString, pathExists } from './utils';

export function COMMAND_runScript_registerCleanup(): vscode.Disposable[] {
    // const disposableDebugSessionListener = vscode.debug.onDidTerminateDebugSession(session => {
    //     // if (session.name !== 'Debug Blender' && !session.name.startsWith('Python at Port '))
    //     //     return
    //     const id = session.configuration.identifier;
    //     RunningBlenders.kill(id);
    // });
    const disposableTaskListener = vscode.tasks.onDidEndTaskProcess((event) => {
        if (event.execution.task.source !== 'blender') {
            return;
        }

        const id = event.execution.task.definition.type;
        RunningBlenders.kill(id);
    });
    return [disposableTaskListener];
}

type RunScriptCommandArguments = {
    path?: string;
} & StartCommandArguments;

export async function COMMAND_runScript(args?: RunScriptCommandArguments): Promise<void> {
    const explicitScriptPath = args?.script ?? args?.path;
    let scriptPath: string | undefined = explicitScriptPath;

    if (scriptPath === undefined) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('no active script');
        }

        const { document } = editor;
        await document.save();
        outputChannel.appendLine(`Blender: Run Script: ${document.uri.fsPath}`);
        scriptPath = document.uri.fsPath;
    }

    if (!scriptPath) {
        throw new Error('script path could not be determined');
    }

    const instances = await RunningBlenders.getResponsive();

    if (instances.length > 0) {
        await RunningBlenders.sendToResponsive({ type: 'script', path: scriptPath });
        return;
    }

    const commandArgs: StartCommandArguments = {
        script: scriptPath,
        blenderExecutable: args?.blenderExecutable,
    };
    await COMMAND_start(commandArgs);
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
    if (!editor) {
        return;
    }

    const items = (await getAreaTypeItems()).map<PickItem>((item) => ({
        label: item.name,
        description: item.identifier,
    }));
    const item = await letUserPickItem(items);

    if (typeof item.description !== 'string') {
        throw new Error('No context selected.');
    }

    await setScriptContext(editor.document, item.description);
}

async function setScriptContext(document: vscode.TextDocument, areaType: string): Promise<void> {
    const workspaceEdit = new vscode.WorkspaceEdit();
    const [line, match] = findAreaContextLine(document);

    if (match === null) {
        workspaceEdit.insert(document.uri, new vscode.Position(0, 0), `# context.area: ${areaType}\n`);
    } else {
        const start = new vscode.Position(line, match[0].length);
        const end = new vscode.Position(line, document.lineAt(line).range.end.character);
        const range = new vscode.Range(start, end);
        workspaceEdit.replace(document.uri, range, areaType);
    }

    await vscode.workspace.applyEdit(workspaceEdit);
}

function findAreaContextLine(document: vscode.TextDocument): [number, RegExpMatchArray | null] {
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const line = document.lineAt(lineIndex);
        const match = line.text.match(/^\s*#\s*context\.area\s*:\s*/i);
        if (match !== null) {
            return [lineIndex, match];
        }
    }

    return [-1, null];
}

async function getPathForNewScript(): Promise<[string, string]> {
    const folderPath = await getFolderForScripts();
    const fileName = await askUser_ScriptFileName(folderPath);
    const filePath = path.join(folderPath, fileName);

    if (await pathExists(filePath)) {
        throw new Error('file exists already');
    }

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

    const items: PickItem[] = scriptFolders.map((folderData) => {
        const useCustomName = folderData.name !== '';
        return {
            label: useCustomName ? folderData.name : folderData.path,
            data: async () => folderData,
        };
    });

    items.push({
        label: 'New Folder...',
        data: askUser_ScriptFolder,
    });

    const item = await letUserPickItem(items);
    const folderData = await item.data();

    if (!scriptFolders.some((data) => data.path === folderData.path)) {
        scriptFolders.push(folderData);
        const config = getConfig();
        await config.update('scripts.directories', scriptFolders, vscode.ConfigurationTarget.Global);
    }

    return folderData.path;
}

export function getStoredScriptFolders(): ScriptFolderData[] {
    const config = getConfig();
    const folders = config.get<ScriptFolderData[]>('scripts.directories');
    return Array.isArray(folders) ? [...folders] : [];
}

async function askUser_ScriptFolder(): Promise<ScriptFolderData> {
    const selection = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Script Folder',
    });

    if (!selection || selection.length === 0) {
        throw cancel();
    }

    const [folderUri] = selection;
    return {
        path: folderUri.fsPath,
        name: '',
    };
}

async function askUser_ScriptFileName(folder: string): Promise<string> {
    const defaultName = await getDefaultScriptName(folder);
    const input = await vscode.window.showInputBox({
        value: defaultName,
    });

    if (input === undefined) {
        throw cancel();
    }

    const trimmedName = input.trim();
    if (trimmedName.length === 0) {
        throw new Error('script name cannot be empty');
    }

    return trimmedName.toLowerCase().endsWith('.py') ? trimmedName : `${trimmedName}.py`;
}

async function getDefaultScriptName(folder: string): Promise<string> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const name = `script ${getRandomString(10)}.py`;
        const candidatePath = path.join(folder, name);
        if (!(await pathExists(candidatePath))) {
            return name;
        }
    }
}