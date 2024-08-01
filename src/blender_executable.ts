import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as child_process from 'child_process';

import { launchPath } from './paths';
import { getServerPort } from './communication';
import { letUserPickItem } from './select_utils';
import { getConfig, cancel, runTask } from './utils';
import { AddonWorkspaceFolder } from './addon_folder';
import { BlenderWorkspaceFolder } from './blender_folder';


export class BlenderExecutable {
    data: BlenderPathData;

    constructor(data: BlenderPathData) {
        this.data = data;
    }

    public static async GetAny() {
        let data = await getFilteredBlenderPath({
            label: 'Blender Executable',
            selectNewLabel: 'Choose a new Blender executable...',
            predicate: () => true,
            setSettings: () => { }
        });
        return new BlenderExecutable(data);
    }

    public static async GetDebug() {
        let data = await getFilteredBlenderPath({
            label: 'Debug Build',
            selectNewLabel: 'Choose a new debug build...',
            predicate: item => item.isDebug,
            setSettings: item => { item.isDebug = true; }
        });
        return new BlenderExecutable(data);
    }

    public static async LaunchAny() {
        await (await this.GetAny()).launch();
    }

    public static async LaunchDebug(folder: BlenderWorkspaceFolder) {
        await (await this.GetDebug()).launchDebug(folder);
    }

    get path() {
        return this.data.path;
    }

    public async launch() {
        let execution = new vscode.ProcessExecution(
            this.path,
            getBlenderLaunchArgs(),
            { env: await getBlenderLaunchEnv() }
        );

        await runTask('blender', execution);
    }

    public async launchDebug(folder: BlenderWorkspaceFolder) {
        let configuration = {
            name: 'Debug Blender',
            type: 'cppdbg',
            request: 'launch',
            program: this.data.path,
            args: ['--debug'].concat(getBlenderLaunchArgs()),
            env: await getBlenderLaunchEnv(),
            stopAtEntry: false,
            MIMode: 'gdb',
            cwd: folder.uri.fsPath,
        };
        vscode.debug.startDebugging(folder.folder, configuration);
    }

    public async launchWithCustomArgs(taskName: string, args: string[]) {
        let execution = new vscode.ProcessExecution(
            this.path,
            args,
        );

        await runTask(taskName, execution, true);
    }
}

interface BlenderPathData {
    path: string;
    name: string;
    isDebug: boolean;
}

interface BlenderType {
    label: string;
    selectNewLabel: string;
    predicate: (item: BlenderPathData) => boolean;
    setSettings: (item: BlenderPathData) => void;
}

async function getFilteredBlenderPath(type: BlenderType): Promise<BlenderPathData> {
    let config = getConfig();
    let allBlenderPaths = <BlenderPathData[]>config.get('executables');
    let usableBlenderPaths = allBlenderPaths.filter(type.predicate);

    let items = [];
    for (let pathData of usableBlenderPaths) {
        let useCustomName = pathData.name !== '' && pathData.name !== undefined;
        items.push({
            data: async () => pathData,
            label: useCustomName ? pathData.name : pathData.path
        });
    }

    items.push({ label: type.selectNewLabel, data: async () => askUser_FilteredBlenderPath(type) });

    let item = await letUserPickItem(items);
    let pathData: BlenderPathData = await item.data();

    if (allBlenderPaths.find(data => data.path === pathData.path) === undefined) {
        allBlenderPaths.push(pathData);
        config.update('executables', allBlenderPaths, vscode.ConfigurationTarget.Global);
    }

    return pathData;
}

async function askUser_FilteredBlenderPath(type: BlenderType): Promise<BlenderPathData> {
    let filepath = await askUser_BlenderPath(type.label);
    let pathData: BlenderPathData = {
        path: filepath,
        name: '',
        isDebug: false,
    };
    type.setSettings(pathData);
    return pathData;
}

async function askUser_BlenderPath(openLabel: string) {
    let value = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: openLabel
    });
    if (value === undefined) return Promise.reject(cancel());
    let filepath = value[0].fsPath;

    if (os.platform() === 'darwin') {
        if (filepath.toLowerCase().endsWith('.app')) {
            filepath += '/Contents/MacOS/blender';
        }
    }

    await testIfPathIsBlender(filepath);
    return filepath;
}

async function testIfPathIsBlender(filepath: string) {
    let name: string = path.basename(filepath);

    if (!name.toLowerCase().startsWith('blender')) {
        return Promise.reject(new Error('Expected executable name to begin with \'blender\''));
    }

    let testString = '###TEST_BLENDER###';
    let command = `"${filepath}" --factory-startup -b --python-expr "import sys;print('${testString}');sys.stdout.flush();sys.exit()"`;

    return new Promise<void>((resolve, reject) => {
        child_process.exec(command, {}, (err, stdout, stderr) => {
            let text = stdout.toString();
            if (!text.includes(testString)) {
                var message = 'A simple check to test if the selected file is Blender failed.';
                message += ' Please create a bug report when you are sure that the selected file is Blender 2.8 or newer.';
                message += ' The report should contain the full path to the executable.';
                reject(new Error(message));
            }
            else {
                resolve();
            }
        });
    });
}

function getBlenderLaunchArgs() {
    let config = getConfig();
    return ['--python', launchPath].concat(<string[]>config.get("additionalArguments", []));
}

async function getBlenderLaunchEnv() {
    let config = getConfig();
    let addons = await AddonWorkspaceFolder.All();
    let loadDirsWithNames = await Promise.all(addons.map(a => a.getLoadDirectoryAndModuleName()));

    return {
        ADDONS_TO_LOAD: JSON.stringify(loadDirsWithNames),
        EDITOR_PORT: getServerPort().toString(),
        ALLOW_MODIFY_EXTERNAL_PYTHON: <boolean>config.get('allowModifyExternalPython') ? 'yes' : 'no',
        ...<object>config.get("environmentVariables", {}),
    };
}
