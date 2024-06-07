import * as path from 'path';
import * as vscode from 'vscode';
import {
    getConfig, readTextFile, getWorkspaceFolders,
    getSubfolders, executeTask, getAnyWorkspaceFolder, pathExists
} from './utils';

// TODO: It would be superior to use custom AddonFolder interface that is not bound to the
// vscode.WorkspaceFolder directly. The 'uri' property is only one used at this point.

export class AddonWorkspaceFolder {
    folder: vscode.WorkspaceFolder;

    constructor(folder: vscode.WorkspaceFolder) {
        this.folder = folder;
    }

    public static async All() {
        // Search folders specified by settings first, if nothing is specified
        // search workspace folders instead.
        let addonFolders = await foldersToWorkspaceFoldersMockup(
            <string[]>getConfig().get('addonFolders'));
        if (addonFolders.length === 0) {
            addonFolders = getWorkspaceFolders();
        }

        let folders = [];
        for (let folder of addonFolders) {
            let addon = new AddonWorkspaceFolder(folder);
            if (await addon.hasAddonEntryPoint()) {
                folders.push(addon);
            }
        }
        return folders;
    }

    get uri() {
        return this.folder.uri;
    }

    get buildTaskName() {
        return <string>this.getConfig().get('addon.buildTaskName');
    }

    get reloadOnSave() {
        return <boolean>this.getConfig().get('addon.reloadOnSave');
    }

    get justMyCode() {
        return <boolean>this.getConfig().get('addon.justMyCode');
    }

    public async hasAddonEntryPoint() {
        try {
            let sourceDir = await this.getSourceDirectory();
            return folderContainsAddonEntry(sourceDir);
        }
        catch (err) {
            return false;
        }
    }

    public async buildIfNecessary() {
        let taskName = this.buildTaskName;
        if (taskName === '') return Promise.resolve();
        await executeTask(taskName, true);
    }

    public getConfig() {
        return getConfig(this.uri);
    }

    public async getLoadDirectoryAndModuleName() {
        let load_dir = await this.getLoadDirectory();
        let module_name = await this.getModuleName();
        return {
            'load_dir' : load_dir,
            'module_name' : module_name,
        };
    }

    public async getModuleName() {
        let value = <string>getConfig(this.uri).get('addon.moduleName');
        if (value === 'auto') {
            return path.basename(await this.getLoadDirectory());
        }
        else {
            return value;
        }
    }

    public async getLoadDirectory() {
        let value = <string>getConfig(this.uri).get('addon.loadDirectory');
        if (value === 'auto') {
            return this.getSourceDirectory();
        }
        else {
            return this.makePathAbsolute(value);
        }
    }

    public async getSourceDirectory() {
        let value = <string>getConfig(this.uri).get('addon.sourceDirectory');
        if (value === 'auto') {
            return await tryFindActualAddonFolder(this.uri.fsPath);
        }
        else {
            return this.makePathAbsolute(value);
        }
    }

    private makePathAbsolute(directory: string) {
        if (path.isAbsolute(directory)) {
            return directory;
        }
        else {
            return path.join(this.uri.fsPath, directory);
        }
    }
}

async function tryFindActualAddonFolder(root: string) {
    if (await folderContainsAddonEntry(root)) return root;
    for (let folder of await getSubfolders(root)) {
        if (await folderContainsAddonEntry(folder)) {
            return folder;
        }
    }
    return Promise.reject(new Error('cannot find actual addon code, please set the path in the settings'));
}

async function folderContainsAddonEntry(folderPath: string) {
    let manifestPath = path.join(folderPath, "blender_manifest.toml");
    if (await pathExists(manifestPath)) {
        return true;
    }
        
    let initPath = path.join(folderPath, '__init__.py');
    try {
        let content = await readTextFile(initPath);
        return content.includes('bl_info');
    }
    catch {
        return false;
    }
}

async function foldersToWorkspaceFoldersMockup(folders: string[]) {
    let mockups: vscode.WorkspaceFolder[] = [];
    // Assume this functionality is only used with a single workspace folder for now.
    let rootFolder = getAnyWorkspaceFolder();
    for (let i = 0; i < folders.length; i++) {
        let absolutePath;
        if (path.isAbsolute(folders[i])) {
            absolutePath = folders[i];
        } else {
            absolutePath = path.join(rootFolder.uri.fsPath, folders[i])
        }

        let exists = await pathExists(absolutePath);
        if (!exists) {
            vscode.window.showInformationMessage(
                `Revise settings, path to addon doesn't exist ${absolutePath}`);
            continue;
        }

        mockups.push({
            "name" : path.basename(absolutePath),
            "uri": vscode.Uri.parse(absolutePath),
            "index": i
        });
    }
    return mockups;
}
