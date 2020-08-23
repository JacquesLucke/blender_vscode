import * as vscode from 'vscode';
import { ensureServer, stopServer } from './server';
import * as development_client from './dev_client';

export function activate(context: vscode.ExtensionContext) {
    const commands: [string, () => Promise<void>][] = [
        ['blender.connect', COMMAND_connect],
        ['blender.quit', COMMAND_quitBlender],
    ];

    for (const [identifier, func] of commands) {
        context.subscriptions.push(vscode.commands.registerCommand(identifier, func));
    }
}

export function deactivate() {
    stopServer();
}

async function COMMAND_connect() {
    const connectionInfoStr = await vscode.window.showInputBox({ placeHolder: 'Connection Information' });
    if (connectionInfoStr === undefined) {
        return;
    }
    const connectionInfo = JSON.parse(connectionInfoStr);
    development_client.setDevelopmentPort(connectionInfo.development_port);
}

async function COMMAND_quitBlender() {
    development_client.sendCommand('quit');
}
