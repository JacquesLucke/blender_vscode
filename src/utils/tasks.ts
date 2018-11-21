import * as path from 'path';
import * as vscode from 'vscode';
import * as generic from './generic';

export async function startExternalProgram(
    command : string, args : string[] = [], additionalEnv : any = {},
    name : string = path.basename(command),
    identifier : any = generic.getRandomString())
{
    let folders = generic.getWorkspaceFolders();
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