import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { templateFilesDir } from './paths';
import { letUserPickItem } from './select_utils';
import { cancel, readTextFile, writeTextFile, getWorkspaceFolders, addFolderToWorkspace } from './utils';

export async function COMMAND_newAddon() {
    let folderPath = await getFolderForNewAddon();
    await tryMakeAddonInFolder(folderPath);
    addFolderToWorkspace(folderPath);
}

async function getFolderForNewAddon(): Promise<string> {
    let items = [];
    for (let workspaceFolder of getWorkspaceFolders()) {
        let folderPath = workspaceFolder.uri.fsPath;
        if (await canAddonBeCreatedInFolder(folderPath)) {
            items.push({ data: async () => folderPath, label: folderPath });
        }
    }
    items.push({ data: selectFolderForAddon, label: "Open Folder..." });
    let item = await letUserPickItem(items);
    return await item.data();
}

async function selectFolderForAddon() {
    let value = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'New Addon'
    });
    if (value === undefined) return Promise.reject(cancel());
    let folderPath = value[0].fsPath;

    if (!(await canAddonBeCreatedInFolder(folderPath))) {
        return Promise.reject(new Error('Cannot create new addon in this folder.'));
    }

    return folderPath;
}

async function tryMakeAddonInFolder(folderPath: string) {
    let [addonName, authorName] = await askUser_SettingsForNewAddon();
    await createNewAddon(folderPath, addonName, authorName);
}

async function canAddonBeCreatedInFolder(folder: string) {
    return new Promise<boolean>(resolve => {
        fs.stat(folder, (err, stat) => {
            if (err !== null) {
                resolve(false);
                return;
            }
            if (!stat.isDirectory()) {
                resolve(false);
                return;
            }

            fs.readdir(folder, {}, (err, files) => {
                for (let name of files) {
                    if (!(<string>name).startsWith('.')) {
                        resolve(false);
                        return;
                    }
                }
                resolve(true);
            });
        });
    });
}

async function askUser_SettingsForNewAddon() {
    let addonName = await vscode.window.showInputBox({ placeHolder: 'Addon Name' });
    if (addonName === undefined) {
        return Promise.reject(cancel());
    }
    else if (addonName === "") {
        return Promise.reject(new Error('Can\'t create an addon without a name.'));
    }

    let authorName = await vscode.window.showInputBox({ placeHolder: 'Your Name' });
    if (authorName === undefined) {
        return Promise.reject(cancel());
    }
    else if (authorName === "") {
        return Promise.reject(new Error('Can\'t create an addon without an author name.'));
    }

    return [<string>addonName, <string>authorName];
}

async function createNewAddon(folder: string, addonName: string, authorName: string) {
    let initSourcePath = path.join(templateFilesDir, 'addon.py');
    let initTargetPath = path.join(folder, "__init__.py");
    let text = await readTextFile(initSourcePath);
    text = text.replace('ADDON_NAME', addonName);
    text = text.replace('AUTHOR_NAME', authorName);
    await writeTextFile(initTargetPath, text);
}
