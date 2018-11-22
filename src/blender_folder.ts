import * as path from 'path';
import * as vscode from 'vscode';
import { runTask } from './utils/tasks';
import { getConfiguration } from './utils/utils';
import { getWorkspaceFolders, pathsExist } from './utils/generic';

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
        let execution = new vscode.ShellExecution(
            this.buildDebugCommand,
            {cwd: this.uri.fsPath}
        );
        await runTask('Build Blender', execution, true, this.folder);
    }

    public getConfig() {
        return getConfiguration(this.uri);
    }
}