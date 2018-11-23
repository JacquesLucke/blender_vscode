import * as fs from 'fs';
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
            if (err.message !== CANCEL) {
                vscode.window.showErrorMessage(err.message);
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
