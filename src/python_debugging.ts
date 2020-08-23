import * as vscode from 'vscode';
import * as communication from './communication';

let ptvsdAddress: { host: string, port: number } | null = null;

export function setPtvsdAddress(host: string | null, port: number | null) {
    if (host === null || port === null) {
        ptvsdAddress = null;
    }
    else {
        ptvsdAddress = { host, port };
    }
}

interface PathMapping {
    localRoot: string;
    remoteRoot: string;
};

export async function COMMAND_attachPythonDebugger() {
    if (ptvsdAddress === null) {
        vscode.window.showErrorMessage('Not connected to Blender.');
        return;
    }

    const config = vscode.workspace.getConfiguration('blender');
    const pathMappings = config.get<PathMapping[]>('pythonPathMappings');

    vscode.debug.startDebugging(undefined, {
        name: `Blender Python`,
        request: 'attach',
        type: 'python',
        port: ptvsdAddress.port,
        host: ptvsdAddress.host,
        pathMappings: pathMappings,
    });
}

communication.registerRequestCommand('/attach_ptvsd', (arg: any) => {
    COMMAND_attachPythonDebugger();
});
