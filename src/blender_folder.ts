import * as vscode from 'vscode';
import { getConfig, getWorkspaceFolders } from './utils';

// todo remove: this class was used maily for C related development
export class BlenderWorkspaceFolder {
    folder: vscode.WorkspaceFolder;

    constructor(folder: vscode.WorkspaceFolder) {
        this.folder = folder;
    }

    public static async Get() {
        for (let folder of getWorkspaceFolders()) {
            let blender = new BlenderWorkspaceFolder(folder);
            return blender;
        }
        return null;
    }

    get uri() {
        return this.folder.uri;
    }

    public getConfig() {
        return getConfig(this.uri);
    }
}
