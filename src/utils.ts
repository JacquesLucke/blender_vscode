import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as crypto from 'crypto';

const CANCEL = 'CANCEL';

export function cancel() {
    return new Error(CANCEL);
}

export async function waitUntilTaskEnds(taskName: string) {
    return new Promise<void>(resolve => {
        let disposable = vscode.tasks.onDidEndTask(e => {
            if (e.execution.task.name === taskName) {
                disposable.dispose();
                resolve();
            }
        });
    });
}

export async function executeTask(taskName: string, wait: boolean = false) {
    await vscode.commands.executeCommand('workbench.action.tasks.runTask', taskName);
    if (wait) {
        await waitUntilTaskEnds(taskName);
    }
}

export function getWorkspaceFolders() {
    let folders = vscode.workspace.workspaceFolders;
    if (folders === undefined) return [];
    else return folders;
}

export function getAnyWorkspaceFolder() {
    let folders = getWorkspaceFolders();
    if (folders.length === 0) {
        throw new Error('no workspace folder found');
    }
    return folders[0];
}

export function handleErrors(func: () => Promise<void>) {
    return async () => {
        try {
            await func();
        }
        catch (err) {
            if (err instanceof Error) {
                if (err.message !== CANCEL) {
                    vscode.window.showErrorMessage(err.message);
                }
            }
        }
    };
}

export function getRandomString(length: number = 10) {
    return crypto.randomBytes(length).toString('hex').substring(0, length);
}

export function readTextFile(path: string) {
    return new Promise<string>((resolve, reject) => {
        fs.readFile(path, 'utf8', (err, data) => {
            if (err !== null) {
                reject(new Error(`Could not read the file: ${path}`));
            }
            else {
                resolve(data);
            }
        });
    });
}

export async function writeTextFile(path: string, content: string) {
    return new Promise<void>((resove, reject) => {
        fs.writeFile(path, content, err => {
            if (err !== null) {
                return reject(err);
            }
            else {
                resove();
            }
        });
    });
}

export async function renamePath(oldPath: string, newPath: string) {
    return new Promise<void>((resolve, reject) => {
        fs.rename(oldPath, newPath, err => {
            if (err !== null) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

export async function copyFile(from: string, to: string) {
    return new Promise<void>((resolve, reject) => {
        fs.copyFile(from, to, err => {
            if (err === null) resolve();
            else reject(err);
        });
    });
}

export async function pathExists(path: string) {
    return new Promise<boolean>(resolve => {
        fs.stat(path, (err, stats) => {
            resolve(err === null);
        });
    });
}

export async function pathsExist(paths: string[]) {
    let promises = paths.map(p => pathExists(p));
    let results = await Promise.all(promises);
    return results.every(v => v);
}

export async function getSubfolders(root: string) {
    return new Promise<string[]>((resolve, reject) => {
        fs.readdir(root, { encoding: 'utf8' }, async (err, files) => {
            if (err !== null) {
                reject(err);
                return;
            }

            let folders = [];
            for (let name of files) {
                let fullpath = path.join(root, name);
                if (await isDirectory(fullpath)) {
                    folders.push(fullpath);
                }
            }

            resolve(folders);
        });
    });
}

export async function isDirectory(filepath: string) {
    return new Promise<boolean>(resolve => {
        fs.stat(filepath, (err, stat) => {
            if (err !== null) resolve(false);
            else resolve(stat.isDirectory());
        });
    });
}

export function getConfig(resource: vscode.Uri | undefined = undefined) {
    return vscode.workspace.getConfiguration('blender', resource);
}

export async function runTask(
    name: string,
    execution: vscode.ProcessExecution | vscode.ShellExecution,
    wait: boolean = false,
    target: vscode.WorkspaceFolder = getAnyWorkspaceFolder(),
    identifier: string = getRandomString()) {
    let taskDefinition = { type: identifier };
    let source = 'blender';
    let problemMatchers: string[] = [];
    let task = new vscode.Task(taskDefinition, target, name, source, execution, problemMatchers);
    let taskExecution = await vscode.tasks.executeTask(task);

    if (wait) {
        return new Promise<vscode.TaskExecution>(resolve => {
            let disposable = vscode.tasks.onDidEndTask(e => {
                if (e.execution.task.definition.type === identifier) {
                    disposable.dispose();
                    resolve(taskExecution);
                }
            });
        });
    }
    else {
        return taskExecution;
    }
}

export function addFolderToWorkspace(folder: string) {
    /* Warning: This might restart all extensions if there was no folder before. */
    vscode.workspace.updateWorkspaceFolders(getWorkspaceFolders().length, null, { uri: vscode.Uri.file(folder) });
}

export function nameToIdentifier(name: string) {
    return name.toLowerCase().replace(/\W+/, '_');
}

export function nameToClassIdentifier(name: string) {
    let parts = name.split(/\W+/);
    let result = '';
    let allowNumber = false;
    for (let part of parts) {
        if (part.length > 0 && (allowNumber || !startsWithNumber(part))) {
            result += part.charAt(0).toUpperCase() + part.slice(1);
            allowNumber = true;
        }
    }
    return result;
}

export function startsWithNumber(text: string) {
    return text.charAt(0).match(/[0-9]/) !== null;
}

export function multiReplaceText(text: string, replacements: object) {
    for (let old of Object.keys(replacements)) {
        let matcher = RegExp(old, 'g');
        text = text.replace(matcher, <string>(<any>replacements)[old]);
    }
    return text;
}

export function isValidPythonModuleName(text: string): boolean {
    let match = text.match(/^[_a-z][_0-9a-z]*$/i);
    return match !== null;
}

export function toTitleCase(str: string) {
  return str.replace(
    /\w\S*/g,
    text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
  );
}
