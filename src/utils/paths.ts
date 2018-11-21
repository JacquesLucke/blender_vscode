import * as path from 'path';
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as generic from './generic';
import * as utils from './utils';


/* Constant paths
 *********************************************/

export const pythonFilesDir = path.join(path.dirname(path.dirname(__dirname)), 'pythonFiles');
export const templateFilesDir = path.join(pythonFilesDir, 'templates');
export const pipPath = path.join(pythonFilesDir, 'get-pip.py');
export const launchPath = path.join(pythonFilesDir, 'launch.py');


/* Get Path to Blender Executable
 *********************************************/

interface BlenderPath {
    path : string;
    name : string;
    isDebug : boolean;
}

export async function getBlenderPath() {
    return await getFilteredBlenderPath('Blender Executable', () => true, () => {});
}

export async function getBlenderPath_Debug() {
    return await getFilteredBlenderPath(
        'Debug Build',
        item => item.isDebug,
        item => { item.isDebug = true; }
    );
}

async function getFilteredBlenderPath(
        openLabel: string,
        predicate : (item : BlenderPath) => boolean,
        setSettings : (item : BlenderPath) => void)
{
    let config = utils.getConfiguration();
    let allBlenderPaths = <BlenderPath[]>config.get('blenderPaths');
    let usableBlenderPaths = allBlenderPaths.filter(predicate);

    if (usableBlenderPaths.length === 0) {
        let blenderPath = await askUser_BlenderPath(openLabel);
        let item = {
            path: blenderPath,
            name: path.basename(path.dirname(blenderPath)),
            isDebug: false
        };
        setSettings(item);
        allBlenderPaths.push(item);
        config.update('blenderPaths', allBlenderPaths, vscode.ConfigurationTarget.Global);
        return blenderPath;
    } else if (usableBlenderPaths.length === 1) {
        return usableBlenderPaths[0].path;
    } else {
        let names = usableBlenderPaths.map(item => item.name);
        let selectedName = await vscode.window.showQuickPick(names);
        return <string>(<BlenderPath>usableBlenderPaths.find(item => item.name === selectedName)).path;
    }
}

async function askUser_BlenderPath(openLabel : string) {
    let value = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: openLabel
        });
    if (value === undefined) return Promise.reject(generic.cancel());
    let filepath = value[0].fsPath;
    await testIfPathIsBlender(filepath);
    return filepath;
}

async function testIfPathIsBlender(filepath : string) {
    let name : string = path.basename(filepath);

    if (!name.toLowerCase().startsWith('blender')) {
        return Promise.reject(new Error('Expected executable name to begin with \'blender\''));
    }

    let testString = '###TEST_BLENDER###';
    let command = `${filepath} --factory-startup -b --python-expr "import sys;print('${testString}');sys.stdout.flush();sys.exit()"`;

    return new Promise<void>((resolve, reject) => {
        child_process.exec(command, {}, (err, stdout, stderr) => {
            let text = stdout.toString();
            if (!text.includes(testString)) {
                reject(new Error('Path is not Blender.'));
            } else {
                resolve();
            }
        });
    });
}


/* Addon paths
 *********************************************/

export function getAddonLoadDirectory(uri : vscode.Uri) {
    return makePathAbsolute(<string>utils.getConfiguration(uri).get('addon.loadDirectory'), uri.fsPath);
}

export function getAddonSourceDirectory(uri : vscode.Uri) {
    return makePathAbsolute(<string>utils.getConfiguration(uri).get('addon.sourceDirectory'), uri.fsPath);
}

function makePathAbsolute(directory : string, root : string) {
    if (path.isAbsolute(directory)) {
        return directory;
    } else {
        return path.join(root, directory);
    }
}