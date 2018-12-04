import * as path from 'path';
import * as vscode from 'vscode';
import * as os from 'os';
import { BlenderWorkspaceFolder } from './blender_folder';
import { getStoredScriptFolders } from './scripts';
import { AddonPathMapping } from './communication';

type PathMapping = { localRoot: string, remoteRoot: string };

export async function attachPythonDebuggerToBlender(
    port: number, blenderPath: string, scriptsFolder: string,
    addonPathMappings: AddonPathMapping[]) {

    let mappings = await getPythonPathMappings(scriptsFolder, addonPathMappings);
    attachPythonDebugger(port, mappings);
}

function attachPythonDebugger(port: number, pathMappings: PathMapping[] = []) {
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

async function getPythonPathMappings(scriptsFolder: string, addonPathMappings: AddonPathMapping[]) {
    let mappings = [];

    mappings.push(await getBlenderScriptsPathMapping(scriptsFolder));

    for (let folder of getStoredScriptFolders()) {
        mappings.push({
            localRoot: folder.path,
            remoteRoot: folder.path
        });
    }

    mappings.push(...addonPathMappings.map(item => ({
        localRoot: item.src,
        remoteRoot: item.load
    })));

    fixMappings(mappings);
    return mappings;
}

async function getBlenderScriptsPathMapping(scriptsFolder: string): Promise<PathMapping> {
    let blender = await BlenderWorkspaceFolder.Get();
    if (blender !== null) {
        return {
            localRoot: path.join(blender.uri.fsPath, 'release', 'scripts'),
            remoteRoot: scriptsFolder
        };
    }
    else {
        return {
            localRoot: scriptsFolder,
            remoteRoot: scriptsFolder
        };
    }
}

function fixMappings(mappings: PathMapping[]) {
    for (let i = 0; i < mappings.length; i++) {
        mappings[i].localRoot = fixPath(mappings[i].localRoot);
    }
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
