import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as util from 'util';

import { launchPath } from './paths';
import { getServerPort, RunningBlenders } from './communication';
import { letUserPickItem, PickItem } from './select_utils';
import { getConfig, cancel, runTask, getAnyWorkspaceFolder, getRandomString } from './utils';
import { AddonWorkspaceFolder } from './addon_folder';
import { outputChannel, showNotificationAddDefault } from './extension';
import { getBlenderWindows } from './blender_executable_windows';
import { deduplicateSameHardLinks } from './blender_executable_linux';

const stat = util.promisify(fs.stat);

export async function LaunchAnyInteractive(blend_filepaths?: string[], script?: string) {
    const executable = await getFilteredBlenderPath({
        label: 'Blender Executable',
        selectNewLabel: 'Choose a new Blender executable...',
        predicate: () => true,
        setSettings: () => { }
    });
    showNotificationAddDefault(executable);
    return await LaunchAny(executable, blend_filepaths, script);
}

export async function LaunchAny(executable: BlenderExecutableData, blend_filepaths?: string[], script?: string) {
    if (!blend_filepaths?.length) {
        await launch(executable, undefined, script);
        return;
    }
    for (const blend_filepath of blend_filepaths) {
        await launch(executable, blend_filepath, script);
    }
}

export class BlenderTask {
    task: vscode.TaskExecution;
    script?: string;
    vscodeIdentifier: string;

    constructor(task: vscode.TaskExecution, vscode_identifier: string, script?: string) {
        this.task = task;
        this.script = script;
        this.vscodeIdentifier = vscode_identifier;
    }

    public async onStartDebugging() {
        if (this.script !== undefined) {
            await RunningBlenders.sendToResponsive({ type: 'script', path: this.script });
        }
    }
}

export async function launch(data: BlenderExecutableData, blend_filepath?: string, script?: string) {
    const blenderArgs = getBlenderLaunchArgs(blend_filepath);
    const execution = new vscode.ProcessExecution(
        data.path,
        blenderArgs,
        { env: await getBlenderLaunchEnv() }
    );

    outputChannel.appendLine(`Starting blender: ${data.path} ${blenderArgs.join(' ')}`);
    outputChannel.appendLine('With ENV Vars: ' + JSON.stringify(execution.options?.env, undefined, 2));

    const vscode_identifier = getRandomString();
    const task = await runTask('blender', execution, vscode_identifier);

    const blenderTask = new BlenderTask(task, vscode_identifier, script);
    RunningBlenders.registerTask(blenderTask);

    return task;
}

export type BlenderExecutableSettings = {
    path: string;
    name: string;
    linuxInode?: never;
    isDefault?: boolean;
};

export type BlenderExecutableData = {
    path: string;
    name: string;
    linuxInode?: number;
    isDefault?: boolean;
};

async function searchBlenderInSystem(): Promise<BlenderExecutableData[]> {
    const blenders: BlenderExecutableData[] = [];

    if (process.platform === "win32") {
        const windowsBlenders = await getBlenderWindows();
        blenders.push(...windowsBlenders.map(blend_path => ({ path: blend_path, name: "" })));
    }

    const separator = process.platform === "win32" ? ";" : ":";
    const path_env = process.env.PATH?.split(separator);

    if (!path_env) return blenders;

    const exe = process.platform === "win32" ? "blender.exe" : "blender";
    for (const p of path_env) {
        const executable = path.join(p, exe);
        const stats = await stat(executable).catch(() => undefined);
        if (!stats?.isFile()) continue;
        blenders.push({ path: executable, name: "", linuxInode: stats.ino });
    }

    return blenders;
}

interface BlenderType {
    label: string;
    selectNewLabel: string;
    predicate: (item: BlenderExecutableData) => boolean;
    setSettings: (item: BlenderExecutableData) => void;
}

async function getFilteredBlenderPath(type: BlenderType): Promise<BlenderExecutableData> {
    let result: BlenderExecutableData[] = [];

    const blenderPathsInSystem: BlenderExecutableData[] = await searchBlenderInSystem();
    const deduplicatedBlenderPaths: BlenderExecutableData[] = deduplicateSamePaths(blenderPathsInSystem);

    if (process.platform !== 'win32') {
        try {
            result = await deduplicateSameHardLinks(deduplicatedBlenderPaths, true);
        } catch {
            result = deduplicatedBlenderPaths;
        }
    } else {
        result = deduplicatedBlenderPaths;
    }

    const config = getConfig();
    const settingsBlenderPaths = (<BlenderExecutableData[]>config.get('executables')).filter(type.predicate);

    // deduplicate Blender paths again
    const deduplicatedForUI: BlenderExecutableData[] = deduplicateSamePaths(result, settingsBlenderPaths);

    if (process.platform !== 'win32') {
        try {
            result = [...settingsBlenderPaths, ...await deduplicateSameHardLinks(deduplicatedForUI, false, settingsBlenderPaths)];
        } catch {
            result = [...settingsBlenderPaths, ...deduplicatedForUI];
        }
    } else {
        result = [...settingsBlenderPaths, ...deduplicatedForUI];
    }

    const quickPickItems: PickItem[] = [];
    for (const blenderPath of result) {
        quickPickItems.push({
            data: async () => blenderPath,
            label: blenderPath.name || blenderPath.path,
            description: await stat(path.isAbsolute(blenderPath.path) ? blenderPath.path : path.join(getAnyWorkspaceFolder().uri.fsPath, blenderPath.path))
                .then(() => undefined)
                .catch(() => "File does not exist")
        });
    }

    quickPickItems.push({ label: type.selectNewLabel, data: async () => askUser_FilteredBlenderPath(type) });

    const pickedItem = await letUserPickItem(quickPickItems);
    const pathData: BlenderExecutableData = await pickedItem.data();

    if (!settingsBlenderPaths.find(data => data.path === pathData.path)) {
        settingsBlenderPaths.push(pathData);
        const toSave: BlenderExecutableSettings[] = settingsBlenderPaths.map(item => ({ name: item.name, path: item.path, isDefault: item.isDefault }));
        config.update('executables', toSave, vscode.ConfigurationTarget.Global);
    }

    return pathData;
}

function deduplicateSamePaths(blenderPathsToReduce: BlenderExecutableData[], additionalBlenderPaths: BlenderExecutableData[] = []): BlenderExecutableData[] {
    const deduplicated: BlenderExecutableData[] = [];
    const uniquePaths: string[] = [];
    const isTheSamePath = (a: string, b: string) => path.relative(a, b) === '';
    for (const item of blenderPathsToReduce) {
        if (uniquePaths.some(p => isTheSamePath(item.path, p))) continue;
        if (additionalBlenderPaths.some(bp => isTheSamePath(item.path, bp.path))) continue;
        uniquePaths.push(item.path);
        deduplicated.push(item);
    }
    return deduplicated;
}

async function askUser_FilteredBlenderPath(type: BlenderType): Promise<BlenderExecutableData> {
    const filepath = await askUser_BlenderPath(type.label);
    const pathData: BlenderExecutableData = { path: filepath, name: '' };
    type.setSettings(pathData);
    return pathData;
}

async function askUser_BlenderPath(openLabel: string) {
    const value = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: openLabel
    });

    if (!value) return Promise.reject(cancel());

    let filepath = value[0].fsPath;

    if (os.platform() === 'darwin' && filepath.toLowerCase().endsWith('.app')) {
        filepath += '/Contents/MacOS/blender';
    }

    await testIfPathIsBlender(filepath);
    return filepath;
}

async function testIfPathIsBlender(filepath: string) {
    const name = path.basename(filepath);
    if (!name.toLowerCase().startsWith('blender')) {
        return Promise.reject(new Error("Expected executable name to begin with 'blender'"));
    }

    const testString = '###TEST_BLENDER###';
    const command = `"${filepath}" --factory-startup -b --python-expr "import sys;print('${testString}');sys.stdout.flush();sys.exit()"`;

    return new Promise<void>((resolve, reject) => {
        child_process.exec(command, {}, (err, stdout) => {
            const text = stdout.toString();
            if (!text.includes(testString)) {
                reject(new Error('A simple check to test if the selected file is Blender failed. Ensure Blender 2.8+ and provide full executable path.'));
            } else {
                resolve();
            }
        });
    });
}

function getBlenderLaunchArgs(blend_filepath?: string): string[] {
    const config = getConfig();
    let additional_args: string[] = [];

    if (blend_filepath) {
        if (!fs.existsSync(blend_filepath)) throw new Error(`File does not exist: '${blend_filepath}'`);

        const pre_args: string[] = <string[]>config.get("preFileArguments", []);
        const post_args: string[] = <string[]>config.get("postFileArguments", []);

        for (const [index, arg] of pre_args.entries()) {
            if (arg === "--" || arg.startsWith("-- ")) {
                outputChannel.appendLine(`WARNING: ignoring remaining preFileArguments after '--'. Please move [${pre_args.slice(index).join(', ')}] to postFileArguments.`);
                break;
            }
            additional_args.push(arg);
        }
        additional_args.push(blend_filepath);
        additional_args.push(...post_args);
    } else {
        additional_args = <string[]>config.get("additionalArguments", []);
    }

    return ['--python', launchPath, ...additional_args];
}

async function getBlenderLaunchEnv(): Promise<Record<string, any>> {
    const config = getConfig();
    const addons = await AddonWorkspaceFolder.All();
    const loadDirsWithNames = await Promise.all(addons.map(a => a.getLoadDirectoryAndModuleName()));

    return {
        ADDONS_TO_LOAD: JSON.stringify(loadDirsWithNames),
        VSCODE_EXTENSIONS_REPOSITORY: <string>config.get("addon.extensionsRepository"),
        VSCODE_LOG_LEVEL: <string>config.get("addon.logLevel"),
        EDITOR_PORT: getServerPort().toString(),
        ...<object>config.get("environmentVariables", {}),
    };
}
