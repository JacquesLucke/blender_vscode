import * as path from 'path';
import * as vscode from 'vscode';
import { AddonFolder } from './addon_folder';
import { BlenderFolder } from './blender_folder';

export async function attachPythonDebuggerToBlender(
    port : number, blenderPath : string, scriptsFolder : string)
{
    let mappings = await getPythonPathMappings(blenderPath, scriptsFolder);
    attachPythonDebugger(port, mappings);
}

function attachPythonDebugger(port : number, pathMappings : {localRoot:string, remoteRoot:string}[] = []) {
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
    for (let addon of await AddonFolder.All()) {
        mappings.push({
            localRoot: addon.getSourceDirectory(),
            remoteRoot: addon.getLoadDirectory(),
        });
    }
    let blender = await BlenderFolder.Get();
    if (blender !== null) {
        mappings.push({
            localRoot: path.join(blender.uri.fsPath, 'release', 'scripts'),
            remoteRoot: scriptsFolder
        });
    }
    return mappings;
}