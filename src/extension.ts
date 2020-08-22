import * as vscode from 'vscode';
import { ensureServer, stopServer } from './server';

export function activate(context: vscode.ExtensionContext) {
    console.log('Hello World');
    let port = ensureServer();
    console.log('Port: ' + port);

    const commands: [string, () => Promise<void>][] = [
        ['blender.connect', COMMAND_connect],
    ];

    for (const [identifier, func] of commands) {
        context.subscriptions.push(vscode.commands.registerCommand(identifier, func));
    }
}

export function deactivate() {
    stopServer();
}

async function COMMAND_connect() { }
