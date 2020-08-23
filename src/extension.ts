import * as vscode from 'vscode';
import * as communication from './communication';
import * as path from 'path';
import * as child_process from 'child_process';

export function activate(context: vscode.ExtensionContext) {
    const commands: [string, () => Promise<void>][] = [
        ['blender.connect', COMMAND_connect],
        ['blender.quit', COMMAND_quitBlender],
        ['blender.start', COMMAND_start],
    ];

    for (const [identifier, func] of commands) {
        context.subscriptions.push(vscode.commands.registerCommand(identifier, func));
    }
}

export function deactivate() {
    communication.stopServer();
}

interface ConnectionInfo {
    host: string,
    ptvsd_port: number,
    communication_port: number,
};

async function COMMAND_connect() {
    const infoStr = await vscode.window.showInputBox({ placeHolder: 'Connection Information' });
    if (infoStr === undefined) {
        return;
    }
    const info: ConnectionInfo = JSON.parse(infoStr);
    communication.setBlenderAddress(`${info.host}:${info.communication_port}`);
    const ownAddress = `localhost:${communication.getServerPort()}`;
    communication.sendCommand('/set_vscode_address', ownAddress);
}

async function COMMAND_quitBlender() {
    communication.sendCommand('/quit');
}

async function COMMAND_start() {
    const blenderPath = '/home/jacques/blender-git/build_linux/bin/blender';
    const launchPath = path.join(path.dirname(__dirname), 'src', 'launch.py');

    const execution = new vscode.ProcessExecution(
        blenderPath,
        ['--python', launchPath],
    );
    const taskDefinition = { type: 'blender' };
    const problemMatchers: string[] = [];
    const task = new vscode.Task(taskDefinition, vscode.TaskScope.Global, 'blender', 'blender', execution, problemMatchers);
    vscode.tasks.executeTask(task);
}
