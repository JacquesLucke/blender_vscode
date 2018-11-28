import * as vscode from 'vscode';
import * as path from 'path';
import { sendToBlender } from './communication';
import { letUserPickItem } from './select_utils';
import { templateFilesDir } from './paths';
import { getConfig, cancel, addFolderToWorkspace, getRandomString, pathExists, copyFile } from './utils';

export async function COMMAND_runScript(): Promise<void> {
    let editor = vscode.window.activeTextEditor;
    if (editor === undefined) return Promise.reject(new Error('no active script'));

    let document = editor.document;
    await document.save();
    sendToBlender({ type: 'script', path: document.uri.fsPath });
}

export async function COMMAND_newScript(): Promise<void> {
    let folderPath = await getFolderForNewScript();
    let fileName = await askUser_ScriptFileName(folderPath);
    let filePath = path.join(folderPath, fileName);

    if (await pathExists(filePath)) {
        return Promise.reject(new Error('file exists already'));
    }

    let defaultScriptPath = path.join(templateFilesDir, 'script.py');
    await copyFile(defaultScriptPath, filePath);
    await vscode.window.showTextDocument(vscode.Uri.file(filePath));
    await vscode.commands.executeCommand('cursorBottom');
    addFolderToWorkspace(folderPath);
}

interface ScriptFolderData {
    path: string;
    name: string;
}

async function getFolderForNewScript() {
    let config = getConfig();
    let scriptFolders = <ScriptFolderData[]>config.get('scripts.directories');

    let items = [];
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
        config.update('scripts.directories', scriptFolders, vscode.ConfigurationTarget.Global);
    }

    return folderData.path;
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
