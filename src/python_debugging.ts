import * as vscode from 'vscode';

let ptvsdAddress: { host: string, port: number } | null = null;

export function setPtvsdAddress(host: string | null, port: number | null) {
    if (host === null || port === null) {
        ptvsdAddress = null;
    }
    else {
        ptvsdAddress = { host, port };
    }
}

export async function COMMAND_attachPythonDebugger() {
    if (ptvsdAddress === null) {
        vscode.window.showErrorMessage('Not connected to Blender.');
        return;
    }

    vscode.debug.startDebugging(undefined, {
        name: `Blender Python`,
        request: 'attach',
        type: 'python',
        port: ptvsdAddress.port,
        host: ptvsdAddress.host,
        pathMappings: [],
    });
}
