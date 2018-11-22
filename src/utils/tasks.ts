import * as vscode from 'vscode';
import { getRandomString, getAnyWorkspaceFolder } from './generic';

export async function runTask(
    name : string,
    execution : vscode.ProcessExecution | vscode.ShellExecution,
    wait : boolean = false,
    target : vscode.WorkspaceFolder = getAnyWorkspaceFolder(),
    identifier : string = getRandomString())
{
    let taskDefinition = {type: identifier};
    let source = 'blender';
    let problemMatchers : string[] = [];
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
    } else {
        return taskExecution;
    }
}