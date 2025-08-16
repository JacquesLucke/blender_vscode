import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { templateFilesDir } from './paths';
import { letUserPickItem } from './select_utils';
import {
    cancel, readTextFile, writeTextFile, getWorkspaceFolders,
    addFolderToWorkspace, multiReplaceText, pathExists,
    isValidPythonModuleName, renamePath, toTitleCase
} from './utils';

type AddonBuilder = (path: string, addonName: string, authorName: string, supportLegacy: boolean) => Promise<string>;

const addonTemplateDir = path.join(templateFilesDir, 'addons');
const manifestFile = path.join(templateFilesDir, 'blender_manifest.toml')

export async function COMMAND_newAddon() {
    let builder = await getNewAddonGenerator();
    let [addonName, authorName, supportLegacy] = await askUser_SettingsForNewAddon();
    let folderPath = await getFolderForNewAddon();
    folderPath = await fixAddonFolderName(folderPath);
    let mainPath = await builder(folderPath, addonName, authorName, supportLegacy);

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
        let message: string = 'Cannot create new addon in this folder.';
        message += ' Maybe it contains other files already.';
        return Promise.reject(new Error(message));
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

async function fixAddonFolderName(folder: string) {
    let name = path.basename(folder);
    if (isValidPythonModuleName(name)) {
        return folder;
    }

    let items = [];
    let alternatives = getFolderNameAlternatives(name).map(newName => path.join(path.dirname(folder), newName));
    items.push(...alternatives.filter(async p => !(await pathExists(p))).map(p => ({ label: p, data: p })));
    items.push({ label: "Don't change the name.", data: folder });

    let item = await letUserPickItem(items, 'Warning: This folder name should not be used.');
    let newPath = item.data;
    if (folder !== newPath) {
        renamePath(folder, newPath);
    }
    return newPath;
}

function getFolderNameAlternatives(name: string): string[] {
    let alternatives = [];
    alternatives.push(name.replace(/\W/, '_'));
    alternatives.push(name.replace(/\W/, ''));
    return alternatives;
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
    
    let items = [];
    items.push({ label: "Yes", data: true });
    items.push({ label: "No", data: false });
    let item = await letUserPickItem(items, "Support legacy Blender versions (<4.2)?");
    let supportLegacy = item.data;

    return [<string>addonName, <string>authorName, supportLegacy];
}

async function generateAddon_Simple(folder: string, addonName: string, authorName: string, supportLegacy: boolean) {
    let srcDir = path.join(addonTemplateDir, 'simple');

    let initSourcePath = path.join(srcDir, '__init__.py');
    let initTargetPath = path.join(folder, '__init__.py');
    await copyModifiedInitFile(initSourcePath, initTargetPath, addonName, authorName, supportLegacy);

    let manifestTargetPath = path.join(folder, 'blender_manifest.toml');
    await copyModifiedManifestFile(manifestFile, manifestTargetPath, addonName, authorName);
    
    return manifestTargetPath;
}

async function generateAddon_WithAutoLoad(folder: string, addonName: string, authorName: string, supportLegacy: boolean) {
    let srcDir = path.join(addonTemplateDir, 'with_auto_load');

    let initSourcePath = path.join(srcDir, '__init__.py');
    let initTargetPath = path.join(folder, '__init__.py');
    await copyModifiedInitFile(initSourcePath, initTargetPath, addonName, authorName, supportLegacy);
    
    let manifestTargetPath = path.join(folder, 'blender_manifest.toml');
    await copyModifiedManifestFile(manifestFile, manifestTargetPath, addonName, authorName);
    
    let autoLoadSourcePath = path.join(srcDir, 'auto_load.py');
    let autoLoadTargetPath = path.join(folder, 'auto_load.py');
    await copyFileWithReplacedText(autoLoadSourcePath, autoLoadTargetPath, {});

    try {
        let defaultFilePath = path.join(folder, await getDefaultFileName());
        if (!(await pathExists(defaultFilePath))) {
            await writeTextFile(defaultFilePath, 'import bpy\n');
        }
        return defaultFilePath;
    }
    catch {
        return manifestTargetPath;
    }
}

async function getDefaultFileName() {
    let items = [];
    items.push({ label: '__init__.py' });
    items.push({ label: 'operators.py' });

    let item = await letUserPickItem(items, 'Open File');
    return item.label;
}

async function copyModifiedInitFile(src: string, dst: string, addonName: string, authorName: string, supportLegacy: boolean) {
    let replacements;

    // Remove bl_info if not supporting legacy addon system
    if (supportLegacy) {
        replacements = {
            ADDON_NAME: toTitleCase(addonName),
            AUTHOR_NAME: authorName,
        }
    }
    else {
        // https://regex101.com/r/RmBWrk/1
        replacements = {
            'bl_info.+=.+{[\\s\\S]*}\\s*': '',
        }
    }
    await copyFileWithReplacedText(src, dst, replacements);
}

async function copyModifiedManifestFile(src: string, dst: string, addonName: string, authorName: string) {
    let replacements = {
        ADDON_ID: addonName.toLowerCase().replace(/\s/g, '_'),
        ADDON_NAME: toTitleCase(addonName),
        AUTHOR_NAME: authorName,
    };
    await copyFileWithReplacedText(src, dst, replacements);
}

async function copyFileWithReplacedText(src: string, dst: string, replacements: object) {
    let text = await readTextFile(src);
    let new_text = multiReplaceText(text, replacements);
    await writeTextFile(dst, new_text);
}
