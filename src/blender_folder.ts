import * as vscode from 'vscode';
import * as path from 'path';
import { getConfiguration } from './utils/utils';
import { getWorkspaceFolders, pathsExist, waitUntilTaskEnds } from './utils/generic';
import { startShellCommand } from './utils/tasks';

export class BlenderFolder {
    folder : vscode.WorkspaceFolder;

    constructor(folder : vscode.WorkspaceFolder) {
        this.folder = folder;
    }

    public static async Get() {
        for (let folder of getWorkspaceFolders()) {
            let blender = new BlenderFolder(folder);
            if (await blender.isValid()) {
                return blender;
            }
        }
        return null;
    }

    public async isValid() {
        let paths = ['doc', 'source', 'release'].map(n => path.join(this.uri.fsPath, n));
        return pathsExist(paths);
    }

    get uri() {
        return this.folder.uri;
    }

    get buildDebugCommand() {
        return <string>this.getConfig().get('core.buildDebugCommand');
    }

    public async buildDebug() {
        await startShellCommand(this.buildDebugCommand, this.folder);
        await waitUntilTaskEnds(this.buildDebugCommand);
    }

    public getConfig() {
        return getConfiguration(this.uri);
    }
}