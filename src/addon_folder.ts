import * as path from 'path';
import * as vscode from 'vscode';
import { getConfig, readTextFile, getWorkspaceFolders, executeTask, getSubfolders } from './utils';

export class AddonWorkspaceFolder {
    folder: vscode.WorkspaceFolder;

    constructor(folder: vscode.WorkspaceFolder) {
        this.folder = folder;
    }

    public static async All() {
        let folders = [];
        for (let folder of getWorkspaceFolders()) {
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

    public async getModuleName() {
        return path.basename(await this.getLoadDirectory());
    }

    public async hasAddonEntryPoint() {
        let sourceDir = await this.getSourceDirectory();
        return folderContainsAddonEntry(sourceDir);
    }

    public async buildIfNecessary() {
        let taskName = this.buildTaskName;
        if (taskName === '') return Promise.resolve();
        await executeTask(taskName, true);
    }

    public getConfig() {
        return getConfig(this.uri);
    }

    public async getLoadDirectory() {
        let value = <string>getConfig(this.uri).get('addon.loadDirectory');
        if (value === 'auto') return this.getSourceDirectory();
        else return this.makePathAbsolute(value);
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
    let initPath = path.join(folderPath, '__init__.py');
    try {
        let content = await readTextFile(initPath);
        return content.includes('bl_info');
    }
    catch {
        return false;
    }
}
