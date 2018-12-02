import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { templateFilesDir } from './paths';
import { letUserPickItem } from './select_utils';
import { cancel, readTextFile, writeTextFile, getWorkspaceFolders, addFolderToWorkspace } from './utils';

type AddonBuilder = (path: string, addonName: string, authorName: string) => Promise<string>;

const addonTemplateDir = path.join(templateFilesDir, 'addons');

export async function COMMAND_newAddon() {
    let builder = await getNewAddonGenerator();
    let [addonName, authorName] = await askUser_SettingsForNewAddon();
    let folderPath = await getFolderForNewAddon();
    let mainPath = await builder(folderPath, addonName, authorName);

    await vscode.window.showTextDocument(vscode.Uri.file(mainPath));
    addFolderToWorkspace(folderPath);
}

async function getNewAddonGenerator(): Promise<AddonBuilder> {
    let items = [];
    items.push({ label: 'Simple', data: generateAddon_Simple });
    items.push({ label: 'With Auto Load', data: generateAddon_WithAutoLoad });
    let item = await letUserPickItem(items, 'Choose Template');
    return item.data;
}

async function getFolderForNewAddon(): Promise<string> {
    let items = [];

    for (let workspaceFolder of getWorkspaceFolders()) {
        let folderPath = workspaceFolder.uri.fsPath;
        if (await canAddonBeCreatedInFolder(folderPath)) {
            items.push({ data: async () => folderPath, label: folderPath });
        }
    }

    if (items.length > 0) {
        items.push({ data: selectFolderForAddon, label: 'Open Folder...' });
        let item = await letUserPickItem(items);
        return await item.data();
    }
    else {
        return await selectFolderForAddon();
    }
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

async function generateAddon_Simple(folder: string, addonName: string, authorName: string) {
    let srcDir = path.join(addonTemplateDir, 'simple');

    let initSourcePath = path.join(srcDir, '__init__.py');
    let initTargetPath = path.join(folder, '__init__.py');
    await copyModifiedInitFile(initSourcePath, initTargetPath, addonName, authorName);

    return initTargetPath;
}

async function generateAddon_WithAutoLoad(folder: string, addonName: string, authorName: string) {
    let srcDir = path.join(addonTemplateDir, 'with_auto_load');

    let initSourcePath = path.join(srcDir, '__init__.py');
    let initTargetPath = path.join(folder, '__init__.py');
    await copyModifiedInitFile(initSourcePath, initTargetPath, addonName, authorName);

    let autoLoadSourcePath = path.join(srcDir, 'auto_load.py');
    let autoLoadTargetPath = path.join(folder, 'auto_load.py');
    await copyFileWithReplacedText(autoLoadSourcePath, autoLoadTargetPath, {});

    return initTargetPath;
}

async function copyModifiedInitFile(src: string, dst: string, addonName: string, authorName: string) {
    await copyFileWithReplacedText(src, dst, {
        ADDON_NAME: addonName,
        AUTHOR_NAME: authorName,
    });
}

async function copyFileWithReplacedText(src: string, dst: string, replacements: object) {
    let text = await readTextFile(src);
    let new_text = multiReplaceText(text, replacements);
    await writeTextFile(dst, new_text);
}

function multiReplaceText(text: string, replacements: object) {
    for (let old of Object.keys(replacements)) {
        text = text.replace(old, <string>(<any>replacements)[old]);
    }
    return text;
}