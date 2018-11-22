import * as vscode from 'vscode';


export function getConfiguration(resource : vscode.Uri | undefined = undefined) {
    return vscode.workspace.getConfiguration('blender', resource);
}