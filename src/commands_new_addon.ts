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
const manifestFile = path.join(templateFilesDir, 'blender_manifest.toml');

export async function COMMAND_newAddon() {
    const builder = await getNewAddonGenerator();
    const [addonName, authorName, supportLegacy] = await askUser_SettingsForNewAddon();
    let folderPath = await getFolderForNewAddon();
    folderPath = await fixAddonFolderName(folderPath);
    const mainPath = await builder(folderPath, addonName, authorName, supportLegacy);

    await vscode.window.showTextDocument(vscode.Uri.file(mainPath));
    addFolderToWorkspace(folderPath);
}

async function getNewAddonGenerator(): Promise<AddonBuilder> {
    const items = [];
    items.push({ label: 'Simple', data: generateAddon_Simple });
    items.push({ label: 'With Auto Load', data: generateAddon_WithAutoLoad });
    const item = await letUserPickItem(items, 'Choose Template');
    return item.data;
}

async function getFolderForNewAddon(): Promise<string> {
    const items = [];

    for (const workspaceFolder of getWorkspaceFolders()) {
        const folderPath = workspaceFolder.uri.fsPath;
        if (await canAddonBeCreatedInFolder(folderPath)) {
            items.push({ data: async () => folderPath, label: folderPath });
        }
    }

    if (items.length > 0) {
        items.push({ data: selectFolderForAddon, label: 'Open Folder...' });
        const item = await letUserPickItem(items);
        return await item.data();
    }
    return await selectFolderForAddon();
}

async function selectFolderForAddon() {
    const value = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'New Addon'
    });
    if (value === undefined) {
        return Promise.reject(cancel());
    }
    const folderPath = value[0].fsPath;

    if (!(await canAddonBeCreatedInFolder(folderPath))) {
        let message: string = 'Cannot create new addon in this folder.';
        message += ' Maybe it contains other files already.';
        return Promise.reject(new Error(message));
    }

    return folderPath;
}

async function canAddonBeCreatedInFolder(folder: string) {
    try {
        const stat = await fs.promises.stat(folder);
        if (!stat.isDirectory()) {
            return false;
        }

        const files = await fs.promises.readdir(folder);
        for (const name of files) {
            if (!name.startsWith('.')) {
                return false;
            }
        }

        return true;
    } catch {
        return false;
    }
}

async function fixAddonFolderName(folder: string) {
    let name = path.basename(folder);
    if (isValidPythonModuleName(name)) {
        return folder;
    }

    const items = [];
    const directory = path.dirname(folder);
    for (const newName of getFolderNameAlternatives(name)) {
        const candidate = path.join(directory, newName);
        if (!(await pathExists(candidate))) {
            items.push({ label: candidate, data: candidate });
        }
    }
    items.push({ label: "Don't change the name.", data: folder });

    const item = await letUserPickItem(items, 'Warning: This folder name should not be used.');
    const newPath = item.data;
    if (folder !== newPath) {
        renamePath(folder, newPath);
    }
    return newPath;
}

function getFolderNameAlternatives(name: string): string[] {
    return [name.replace(/\W/, '_'), name.replace(/\W/, '')];
}

async function askUser_SettingsForNewAddon() {
    const addonName = await vscode.window.showInputBox({ placeHolder: 'Addon Name' });
    if (addonName === undefined) {
        return Promise.reject(cancel());
    }
    if (addonName === '') {
        return Promise.reject(new Error('Can\'t create an addon without a name.'));
    }

    const authorName = await vscode.window.showInputBox({ placeHolder: 'Your Name' });
    if (authorName === undefined) {
        return Promise.reject(cancel());
    }
    if (authorName === '') {
        return Promise.reject(new Error('Can\'t create an addon without an author name.'));
    }

    const items = [
    { label: 'Yes', data: true },
    { label: 'No', data: false },
];
    const item = await letUserPickItem(items, 'Support legacy Blender versions (<4.2)?');
    const supportLegacy = item.data;

    return [addonName, authorName, supportLegacy];
}

async function generateAddon_Simple(folder: string, addonName: string, authorName: string, supportLegacy: boolean) {
    const srcDir = path.join(addonTemplateDir, 'simple');

    const initSourcePath = path.join(srcDir, '__init__.py');
    const initTargetPath = path.join(folder, '__init__.py');
    await copyModifiedInitFile(initSourcePath, initTargetPath, addonName, authorName, supportLegacy);

    const manifestTargetPath = path.join(folder, 'blender_manifest.toml');
    await copyModifiedManifestFile(manifestFile, manifestTargetPath, addonName, authorName);
    
    return manifestTargetPath;
}

async function generateAddon_WithAutoLoad(folder: string, addonName: string, authorName: string, supportLegacy: boolean) {
    const srcDir = path.join(addonTemplateDir, 'with_auto_load');

    const initSourcePath = path.join(srcDir, '__init__.py');
    const initTargetPath = path.join(folder, '__init__.py');
    await copyModifiedInitFile(initSourcePath, initTargetPath, addonName, authorName, supportLegacy);
    
    const manifestTargetPath = path.join(folder, 'blender_manifest.toml');
    await copyModifiedManifestFile(manifestFile, manifestTargetPath, addonName, authorName);
    
    const autoLoadSourcePath = path.join(srcDir, 'auto_load.py');
    const autoLoadTargetPath = path.join(folder, 'auto_load.py');
    await copyFileWithReplacedText(autoLoadSourcePath, autoLoadTargetPath, {});

    try {
        const defaultFilePath = path.join(folder, await getDefaultFileName());
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
    const items = [
        { label: '__init__.py' },
        { label: 'operators.py' },
    ];
    const item = await letUserPickItem(items, 'Open File');
    return item.label;
}

async function copyModifiedInitFile(src: string, dst: string, addonName: string, authorName: string, supportLegacy: boolean) {
    const replacements = supportLegacy
        ? {
            ADDON_NAME: toTitleCase(addonName),
            AUTHOR_NAME: authorName,
        }
        : {
            // https://regex101.com/r/RmBWrk/1
            'bl_info.+=.+{[\s\S]*}\s*': '',
        };

    await copyFileWithReplacedText(src, dst, replacements);
}

async function copyModifiedManifestFile(src: string, dst: string, addonName: string, authorName: string) {
    const replacements = {
        ADDON_ID: addonName.toLowerCase().replace(/\s/g, '_'),
        ADDON_NAME: toTitleCase(addonName),
        AUTHOR_NAME: authorName,
    };
    await copyFileWithReplacedText(src, dst, replacements);
}

async function copyFileWithReplacedText(src: string, dst: string, replacements: object) {
    const text = await readTextFile(src);
    const updatedText = multiReplaceText(text, replacements);
    await writeTextFile(dst, updatedText);
}
