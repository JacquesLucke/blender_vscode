import * as vscode from 'vscode';
import * as utils from './utils';
import * as paths from './paths';
import * as path from 'path';

export async function attachPythonDebuggerToBlender(port : number, blenderPath : string, scriptsFolder : string) {
    let mappings = await getPythonPathMappings(blenderPath, scriptsFolder);
    attachPythonDebugger(port, mappings);
}

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

async function getPythonPathMappings(blenderPath : string, scriptsFolder : string) {
    let mappings = [];
    for (let folder of await utils.getAddonWorkspaceFolders()) {
        mappings.push({
            localRoot: paths.getAddonSourceDirectory(folder.uri),
            remoteRoot: paths.getAddonLoadDirectory(folder.uri)
        });
    }
    let blenderFolder = await utils.getBlenderWorkspaceFolder();
    if (blenderFolder !== null) {
        mappings.push({
            localRoot: path.join(blenderFolder.uri.fsPath, 'release', 'scripts'),
            remoteRoot: scriptsFolder
        });
    }
    return mappings;
}