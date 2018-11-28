import * as path from 'path';
import * as vscode from 'vscode';
import * as os from 'os';
import { BlenderWorkspaceFolder } from './blender_folder';

export async function attachPythonDebuggerToBlender(
    port: number, blenderPath: string, scriptsFolder: string,
    addonPathMappings: { src: string, load: string }[]) {
    let mappings = await getPythonPathMappings(blenderPath, scriptsFolder);
    mappings.push(...addonPathMappings.map(item => ({
        localRoot: fixPath(item.src),
        remoteRoot: item.load
    })));

    attachPythonDebugger(port, mappings);
}

function attachPythonDebugger(port: number, pathMappings: { localRoot: string, remoteRoot: string }[] = []) {
    let configuration = {
        name: `Python at Port ${port}`,
        request: "attach",
        type: 'python',
        port: port,
        host: 'localhost',
        pathMappings: pathMappings,
    };
    vscode.debug.startDebugging(undefined, configuration);
}

async function getPythonPathMappings(blenderPath: string, scriptsFolder: string) {
    let mappings = [];
    let blender = await BlenderWorkspaceFolder.Get();
    if (blender !== null) {
        mappings.push({
            localRoot: path.join(blender.uri.fsPath, 'release', 'scripts'),
            remoteRoot: scriptsFolder
        });
    }
    return mappings;
}

/* This is to work around a bug where vscode does not find
 * the path: c:\... but only C:\... on windows.
 * https://github.com/Microsoft/vscode-python/issues/2976 */
function fixPath(filepath: string) {
    if (os.platform() !== 'win32') return filepath;

    if (filepath.match(/^[a-zA-Z]:/) !== null) {
        return filepath[0].toUpperCase() + filepath.substring(1);
    }

    return filepath;
}
