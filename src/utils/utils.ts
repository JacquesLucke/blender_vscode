import * as path from 'path';
import * as vscode from 'vscode';
import * as paths from './paths';
import * as generic from './generic';


export function getConfiguration(resource : vscode.Uri | undefined = undefined) {
    return vscode.workspace.getConfiguration('blender', resource);
}

export async function folderIsAddon(folder : vscode.WorkspaceFolder) {
    let sourceDir = paths.getAddonSourceDirectory(folder.uri);
    let initPath = path.join(sourceDir, '__init__.py');
    try {
        let content = await generic.readTextFile(initPath);
        return content.includes('bl_info');
    } catch (err) {
        return false;
    }
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

export async function getAddonWorkspaceFolders() {
    let folders = [];
    for (let folder of generic.getWorkspaceFolders()) {
        if (await folderIsAddon(folder)) {
            folders.push(folder);
        }
    }
    return folders;
}