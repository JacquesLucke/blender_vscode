import * as path from 'path';
import * as vscode from 'vscode';
import * as generic from './generic';


export function getConfiguration(resource : vscode.Uri | undefined = undefined) {
    return vscode.workspace.getConfiguration('blender', resource);
}

export async function folderIsBlender(folder : vscode.WorkspaceFolder) {
    let paths = ['doc', 'source', 'release'].map(n => path.join(folder.uri.fsPath, n));
    return generic.pathsExist(paths);
}

export async function getBlenderWorkspaceFolder() {
    for (let folder of generic.getWorkspaceFolders()) {
        if (await folderIsBlender(folder)) {
            return folder;
        }
    }
    return null;
}