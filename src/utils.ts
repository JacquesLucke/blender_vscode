import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as paths from './paths';

const CANCEL = 'CANCEL';

export function getConfiguration() {
    return vscode.workspace.getConfiguration('blender');
}

export function cancel() {
    return new Error(CANCEL);
}

export async function startBlender(args : string[] = [], additionalEnv : any = {}) {
    let blenderPath = await paths.getBlenderPath();
    let identifier = getRandomString(16);
    additionalEnv = Object.assign(additionalEnv);
    additionalEnv['BLENDER_PROCESS_IDENTIFIER'] = identifier;
    return startExternalProgram(blenderPath, args, additionalEnv, undefined, identifier);
}

export async function startExternalProgram(
        command : string, args : string[] = [], additionalEnv : any = {},
        name : string = path.basename(command),
        identifier : any = getRandomString())
{
    let folders = getWorkspaceFolders();
    if (folders.length === 0) throw new Error('workspace required to run an external command');

    let env = Object.assign({}, process.env, additionalEnv);

    let taskDefinition = {type: identifier};
    let target = folders[0];
    let source = 'blender';
    let execution = new vscode.ProcessExecution(command, args, {env:env, });
    let problemMatchers : string[] = [];
    let task = new vscode.Task(taskDefinition, target, name, source, execution, problemMatchers);
    return vscode.tasks.executeTask(task);
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

export function getRandomString(length : number = 10) {
    return crypto.randomBytes(length).toString('hex').substring(0, length);
}

export function readTextFile(path : string) {
    return new Promise<string>((resolve, reject) => {
        fs.readFile(path, 'utf8', (err : Error, data : any) => {
            if (err !== null) {
                throw new Error(`Could not read the file: ${path}`);
            } else {
                resolve(data);
            }
        });
    });
}