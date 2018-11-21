import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as paths from './paths';

const CANCEL = 'CANCEL';

export function getConfiguration(resource : vscode.Uri | undefined = undefined) {
    return vscode.workspace.getConfiguration('blender', resource);
}

export function cancel() {
    return new Error(CANCEL);
}

export async function startBlender(args : string[] = [], additionalEnv : any = {}) {
    let blenderPath = await paths.getBlenderPath();
    return startExternalProgram(blenderPath, args, additionalEnv);
}

export async function startExternalProgram(
        command : string, args : string[] = [], additionalEnv : any = {},
        name : string = path.basename(command),
        identifier : any = getRandomString())
{
    let folders = getWorkspaceFolders();
    if (folders.length === 0) return Promise.reject(new Error('workspace required to run an external command'));

    let env = Object.assign({}, process.env, additionalEnv);

    let taskDefinition = {type: identifier};
    let target = folders[0];
    let source = 'blender';
    let execution = new vscode.ProcessExecution(command, args, {env:env, });
    let problemMatchers : string[] = [];
    let task = new vscode.Task(taskDefinition, target, name, source, execution, problemMatchers);
    return vscode.tasks.executeTask(task);
}

export async function startShellCommand(command : string, workspaceFolder : vscode.WorkspaceFolder) {
    let taskDefinition = {type: command};
    let target = workspaceFolder;
    let name = command;
    let source = 'blender';
    let execution = new vscode.ShellExecution(command, {cwd:workspaceFolder.uri.fsPath});
    let problemMatchers : string[] = [];
    let task = new vscode.Task(taskDefinition, target, name, source, execution, problemMatchers);
    return vscode.tasks.executeTask(task);
}

export async function waitUntilTaskEnds(taskName : string) {
    return new Promise<void>(resolve => {
        let disposable = vscode.tasks.onDidEndTask(e => {
            if (e.execution.task.name === taskName) {
                disposable.dispose();
                resolve();
            }
        });
    });
}

export function showErrorIfNotCancel(message : string) {
    if (message !== CANCEL) {
        vscode.window.showErrorMessage(message);
    }
}

export function getWorkspaceFolders() {
    let folders = vscode.workspace.workspaceFolders;
    if (folders === undefined) return [];
    else return folders;
}

export function handleErrors(func : () => Promise<void>) {
    return async () => {
        try {
            await func();
        } catch (err) {
            if (err.message !== CANCEL) {
                vscode.window.showErrorMessage(err.message);
            }
        }
    };
}

export function getNewProcessIdentifier() {
    return getRandomString(10);
}

export function getRandomString(length : number = 10) {
    return crypto.randomBytes(length).toString('hex').substring(0, length);
}

export function readTextFile(path : string) {
    return new Promise<string>((resolve, reject) => {
        fs.readFile(path, 'utf8', (err, data) => {
            if (err !== null) {
                reject(new Error(`Could not read the file: ${path}`));
            } else {
                resolve(data);
            }
        });
    });
}

export async function pathExists(path : string) {
    return new Promise<boolean>(resolve => {
        fs.stat(path, (err, stats) => {
            resolve(err === null);
        });
    });
}

export async function pathsExist(paths : string[]) {
    let promises = paths.map(p => pathExists(p));
    let results = await Promise.all(promises);
    return results.every(v => v);
}

export async function folderIsAddon(folder : vscode.WorkspaceFolder) {
    let sourceDir = paths.getAddonSourceDirectory(folder.uri);
    let initPath = path.join(sourceDir, '__init__.py');
    try {
        let content = await readTextFile(initPath);
        return content.includes('bl_info');
    } catch (err) {
        return false;
    }
}

export async function folderIsBlender(folder : vscode.WorkspaceFolder) {
    let paths = ['doc', 'source', 'release'].map(n => path.join(folder.uri.fsPath, n));
    return pathsExist(paths);
}

export async function getBlenderWorkspaceFolder() {
    for (let folder of getWorkspaceFolders()) {
        if (await folderIsBlender(folder)) {
            return folder;
        }
    }
    return null;
}

export async function getAddonWorkspaceFolders() {
    let folders = [];
    for (let folder of getWorkspaceFolders()) {
        if (await folderIsAddon(folder)) {
            folders.push(folder);
        }
    }
    return folders;
}