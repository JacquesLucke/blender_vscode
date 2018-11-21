import * as path from 'path';
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as utils from './utils';

export const pythonFilesDir = path.join(path.dirname(__dirname), 'pythonFiles');
export const templateFilesDir = path.join(pythonFilesDir, 'templates');
export const pipPath = path.join(pythonFilesDir, 'get-pip.py');
export const launchPath = path.join(pythonFilesDir, 'launch.py');


/* Get Path to Blender Executable
 *********************************************/

export async function getBlenderPath() {
    let config = utils.getConfiguration();
    let blenderPaths = <{path:string, name:string}[]>config.get('blenderPaths');

    if (blenderPaths.length === 0) {
        let blenderPath = await askUser_BlenderPath();
        blenderPaths.push({path:blenderPath, name:path.basename(path.dirname(blenderPath))});
        config.update('blenderPaths', blenderPaths, vscode.ConfigurationTarget.Global);
        return blenderPath;
    } else if (blenderPaths.length === 1) {
        return blenderPaths[0].path;
    } else {
        let names = blenderPaths.map(item => item.name);
        let selectedName = await vscode.window.showQuickPick(names);
        return <string>(<any>blenderPaths.find(item => item.name === selectedName)).path;
    }
}

async function askUser_BlenderPath() {
    let value = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: 'Blender Executable'
        });
    if (value === undefined) throw utils.cancel();
    let filepath = value[0].fsPath;
    await testIfPathIsBlender(filepath);
    return filepath;
}

async function testIfPathIsBlender(filepath : string) {
    let name : string = path.basename(filepath);

    if (!name.toLowerCase().startsWith('blender')) {
        throw new Error('Expected executable name to begin with \'blender\'');
    }

    let testString = '###TEST_BLENDER###';
    let command = `${filepath} --factory-startup -b --python-expr "import sys;print('${testString}');sys.stdout.flush();sys.exit()"`;

    return new Promise<void>((resolve, reject) => {
        child_process.exec(command, {}, (err, stdout, stderr) => {
            let text = stdout.toString();
            if (!text.includes(testString)) throw new Error('Path is not Blender.');
            resolve();
        });
    });
}


/* Get paths to addon code
 *****************************************************/

export function getAddonPathMapping() {
    return {
        localRoot: getAddonSourceDirectory(),
        remoteRoot: getAddonLoadDirectory()
    };
}

export function getAddonLoadDirectory() {
    return makeAddonPathAbsolute(<string>utils.getConfiguration().get('addonLoadDirectory'));
}

export function getAddonSourceDirectory() {
    return makeAddonPathAbsolute(<string>utils.getConfiguration().get('addonSourceDirectory'));
}

function makeAddonPathAbsolute(directory : string) {
    if (path.isAbsolute(directory)) {
        return directory;
    } else {
        return path.join(utils.getWorkspaceFolders()[0].uri.fsPath, directory);
    }
}