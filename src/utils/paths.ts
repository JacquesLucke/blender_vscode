import * as path from 'path';
import * as vscode from 'vscode';
import * as utils from './utils';


/* Constant paths
 *********************************************/

export const pythonFilesDir = path.join(path.dirname(path.dirname(__dirname)), 'pythonFiles');
export const templateFilesDir = path.join(pythonFilesDir, 'templates');
export const pipPath = path.join(pythonFilesDir, 'get-pip.py');
export const launchPath = path.join(pythonFilesDir, 'launch.py');


/* Addon paths
 *********************************************/

export function getAddonLoadDirectory(uri : vscode.Uri) {
    return makePathAbsolute(<string>utils.getConfiguration(uri).get('addon.loadDirectory'), uri.fsPath);
}

export function getAddonSourceDirectory(uri : vscode.Uri) {
    return makePathAbsolute(<string>utils.getConfiguration(uri).get('addon.sourceDirectory'), uri.fsPath);
}

function makePathAbsolute(directory : string, root : string) {
    if (path.isAbsolute(directory)) {
        return directory;
    } else {
        return path.join(root, directory);
    }
}