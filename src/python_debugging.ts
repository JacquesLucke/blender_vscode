import * as vscode from 'vscode';
import * as communication from './communication';

let debugpyAddress: { host: string, port: number } | null = null;

export function setDebugpyAddress(host: string | null, port: number | null) {
    if (host === null || port === null) {
        debugpyAddress = null;
    }
    else {
        debugpyAddress = { host, port };
    }
}

interface PathMapping {
    localRoot: string;
    remoteRoot: string;
};

export async function COMMAND_attachPythonDebugger() {
    if (debugpyAddress === null) {
        vscode.window.showErrorMessage('Not connected to Blender.');
        return;
    }

    const config = vscode.workspace.getConfiguration('blender');
    const pathMappings = config.get<PathMapping[]>('pythonPathMappings');

    vscode.debug.startDebugging(undefined, {
        name: `Blender Python`,
        request: 'attach',
        type: 'python',
        port: debugpyAddress.port,
        host: debugpyAddress.host,
        pathMappings: pathMappings,
    });
}

communication.registerRequestCommand('/attach_debugpy', (arg: any) => {
    COMMAND_attachPythonDebugger();
});
