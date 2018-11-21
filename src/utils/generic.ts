import * as fs from 'fs';
import * as vscode from 'vscode';
import * as crypto from 'crypto';

const CANCEL = 'CANCEL';

export function cancel() {
    return new Error(CANCEL);
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