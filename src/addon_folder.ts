import * as vscode from 'vscode';
import * as path from 'path';
import { getConfiguration } from './utils/utils';
import { readTextFile, getWorkspaceFolders, executeTask } from './utils/generic';

export class AddonFolder {
    folder : vscode.WorkspaceFolder;

    constructor(folder : vscode.WorkspaceFolder) {
        this.folder = folder;
    }

    public static async All() {
        let folders = [];
        for (let folder of getWorkspaceFolders()) {
            let addon = new AddonFolder(folder);
            if (await addon.isLoadable()) {
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

    get name() {
        return path.basename(this.getLoadDirectory());
    }

    get reloadOnSave() {
        return <boolean>this.getConfig().get('addon.reloadOnSave');
    }

    public async isLoadable() {
        let sourceDir = this.getSourceDirectory();
        let initPath = path.join(sourceDir, '__init__.py');
        try {
            let content = await readTextFile(initPath);
            return content.includes('bl_info');
        } catch {
            return false;
        }
    }

    public async build() {
        let taskName = this.buildTaskName;
        if (taskName === '') return Promise.resolve();
        await executeTask(taskName, true);
    }

    public getConfig() {
        return getConfiguration(this.uri);
    }

    public getLoadDirectory() {
        return this.makePathAbsolute(<string>getConfiguration(this.uri).get('addon.loadDirectory'));
    }

    public getSourceDirectory() {
        return this.makePathAbsolute(<string>getConfiguration(this.uri).get('addon.sourceDirectory'));
    }

    private makePathAbsolute(directory : string) {
        if (path.isAbsolute(directory)) {
            return directory;
        } else {
            return path.join(this.uri.fsPath, directory);
        }
    }
}