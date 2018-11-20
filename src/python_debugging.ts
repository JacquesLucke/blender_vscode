import * as vscode from 'vscode';

export function attachPythonDebugger(port : number) {
    let configuration = {
        name: `Python at Port ${port}`,
        request: "attach",
        type: "python",
        port: port,
        host: "localhost"
    };
    vscode.debug.startDebugging(undefined, configuration);
}