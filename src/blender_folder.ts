import * as path from 'path';
import * as vscode from 'vscode';
import { runTask, getConfig, getWorkspaceFolders, pathsExist } from './utils';

export class BlenderWorkspaceFolder {
    folder: vscode.WorkspaceFolder;

    constructor(folder: vscode.WorkspaceFolder) {
        this.folder = folder;
    }

    public static async Get() {
        for (let folder of getWorkspaceFolders()) {
            let blender = new BlenderWorkspaceFolder(folder);
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
            { cwd: this.uri.fsPath }
        );
        await runTask('Build Blender', execution, true, this.folder);
    }

    public getConfig() {
        return getConfig(this.uri);
    }
}