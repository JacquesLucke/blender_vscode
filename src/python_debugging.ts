import * as path from 'path';
import * as vscode from 'vscode';
import * as os from 'os';
import { BlenderWorkspaceFolder } from './blender_folder';
import { getStoredScriptFolders } from './scripts';
import { AddonPathMapping } from './communication';
import { printChannelOutput } from './extension';
import { getAnyWorkspaceFolder } from './utils';

type PathMapping = { localRoot: string, remoteRoot: string };

export async function attachPythonDebuggerToBlender(
    port: number, blenderPath: string, justMyCode: boolean, scriptsFolder: string,
    addonPathMappings: AddonPathMapping[]) {

    let mappings = await getPythonPathMappings(scriptsFolder, addonPathMappings);
    attachPythonDebugger(port, justMyCode, mappings);
}

function attachPythonDebugger(port: number, justMyCode: boolean, pathMappings: PathMapping[] = []) {
    let configuration = {
        name: `Python at Port ${port}`,
        request: "attach",
        type: 'python',
        port: port,
        host: 'localhost',
        pathMappings: pathMappings,
        justMyCode: justMyCode
    };

    // log config (reuse common output)
    // let logConfig = vscode.window.createOutputChannel("Blender debugpy [tmp]");
    // logConfig.appendLine("Configuration: " + JSON.stringify(configuration, undefined, 2));
    // logConfig.show();
    printChannelOutput("configuration: " + JSON.stringify(configuration, undefined, 2));

    vscode.debug.startDebugging(undefined, configuration);
}

async function getPythonPathMappings(scriptsFolder: string, addonPathMappings: AddonPathMapping[]) {
    let mappings = [];

    // first of all add the mapping to the addon as it is the most specific one
    mappings.push(...addonPathMappings.map(item => ({
        localRoot: item.src,
        remoteRoot: item.load
    })));

    // optional scripts folders, atm supposed to be global paths
    for (let folder of getStoredScriptFolders()) {
        mappings.push({
            localRoot: folder.path,
            remoteRoot: folder.path
        });
    }

    // add blender scripts last, otherwise it seem to take all the scope and not let the proper mapping of other files
    mappings.push(await getBlenderScriptsPathMapping(scriptsFolder));

    // finally add the workspace folder as last resort for mapping loose scripts inside it
    let wsFolder = getAnyWorkspaceFolder();
    // extension_1.printChannelOutput("wsFolder: " + JSON.stringify(wsFolder, undefined, 2));
    mappings.push({
        localRoot: wsFolder.uri.fsPath,
        remoteRoot: wsFolder.uri.fsPath
    });

    // change drive letter for some systems
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
