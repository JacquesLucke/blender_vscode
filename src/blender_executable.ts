import * as path from 'path';
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { launchPath } from './paths';
import { AddonWorkspaceFolder } from './addon_folder';
import { getServerPort } from './communication';
import { BlenderWorkspaceFolder } from './blender_folder';
import { getConfig, cancel, runTask } from './utils';
import { letUserPickItem } from './select_utils';


export class BlenderExecutable {
    data: BlenderPathData;

    constructor(data: BlenderPathData) {
        this.data = data;
    }

    public static async GetAny() {
        let data = await getFilteredBlenderPath({
            label: 'Blender Executable',
            predicate: () => true,
            setSettings: () => { }
        });
        return new BlenderExecutable(data);
    }

    public static async GetDebug() {
        let data = await getFilteredBlenderPath({
            label: 'Debug Build',
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
    predicate: (item: BlenderPathData) => boolean;
    setSettings: (item: BlenderPathData) => void;
}

async function getFilteredBlenderPath(type: BlenderType): Promise<BlenderPathData> {
    let config = getConfig();
    let allBlenderPaths = <BlenderPathData[]>config.get('blenderPaths');
    let usableBlenderPaths = allBlenderPaths.filter(type.predicate);

    let items = [];
    for (let pathData of usableBlenderPaths) {
        let useCustomName = pathData.name !== '';
        items.push({
            data: async () => pathData,
            label: useCustomName ? pathData.name : pathData.path
        });
    }

    items.push({ label: "New...", data: async () => askUser_FilteredBlenderPath(type) });

    let item = await letUserPickItem(items);
    let pathData: BlenderPathData = await item.data();

    if (allBlenderPaths.find(data => data.path === pathData.path) === undefined) {
        allBlenderPaths.push(pathData);
        config.update('blenderPaths', allBlenderPaths, vscode.ConfigurationTarget.Global);
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
    await testIfPathIsBlender(filepath);
    return filepath;
}

async function testIfPathIsBlender(filepath: string) {
    let name: string = path.basename(filepath);

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
            }
            else {
                resolve();
            }
        });
    });
}

function getBlenderLaunchArgs() {
    return ['--python', launchPath];
}

async function getBlenderLaunchEnv() {
    let config = getConfig();
    let addons = await AddonWorkspaceFolder.All();
    let loadDirs = await Promise.all(addons.map(a => a.getLoadDirectory()));

    return {
        ADDON_DIRECTORIES_TO_LOAD: JSON.stringify(loadDirs),
        EDITOR_PORT: getServerPort().toString(),
        ALLOW_MODIFY_EXTERNAL_PYTHON: <boolean>config.get('allowModifyExternalPython') ? 'yes' : 'no',
    };
}
