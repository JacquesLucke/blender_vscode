import * as vscode from 'vscode';

export function attachPythonDebugger(port : number, pathMappings : {localRoot:string, remoteRoot:string}[] = []) {
    let configuration = {
        name: `Python at Port ${port}`,
        request: "attach",
        type: "python",
        port: port,
        host: "localhost",
        pathMappings: pathMappings,
    };
    vscode.debug.startDebugging(undefined, configuration);
}