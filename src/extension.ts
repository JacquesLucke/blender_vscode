import * as vscode from 'vscode';
import * as os from 'os';
import * as communication from './communication';
import * as fs from 'fs';
import { promisify } from 'util';
import * as path from 'path';
import * as python_debugging from './python_debugging';
import * as glob from 'fast-glob';
import * as errors from './errors';
import * as quick_pick from './quick_pick';

const fsReadFile = promisify(fs.readFile);
const fsReadDir = promisify(fs.readdir);
const fsCopyFile = promisify(fs.copyFile);

const srcPath = path.join(path.dirname(__dirname), 'src');
const templatesDir = path.join(srcPath, 'templates');

export function activate(context: vscode.ExtensionContext) {
    const commands: [string, () => Promise<void>][] = [
        ['blender.connect', COMMAND_connect],
        ['blender.quit', COMMAND_quitBlender],
        ['blender.start', COMMAND_start],
        ['blender.attachPythonDebugger', python_debugging.COMMAND_attachPythonDebugger],
        ['blender.startAndAttachPythonDebugger', COMMAND_startAndAttachPythonDebugger],
        ['blender.manageExecutables', COMMAND_manageExecutables],
        ['blender.reloadAddon', COMMAND_reloadAddon],
        ['blender.newAddon', COMMAND_newAddon],
    ];

    for (const [identifier, func] of commands) {
        context.subscriptions.push(vscode.commands.registerCommand(
            identifier, errors.catchAndShowErrors(func)));
    }
}

export function deactivate() {
    communication.stopServer();
}

interface ConnectionInfo {
    host: string,
    ptvsd_port: number,
    communication_port: number,
};

function setBlenderConnectionInfo(info: ConnectionInfo) {
    communication.setBlenderAddress(`${info.host}:${info.communication_port}`);
    python_debugging.setPtvsdAddress(info.host, info.ptvsd_port);
}

async function COMMAND_connect() {
    const infoStr = await vscode.window.showInputBox({ placeHolder: 'Connection Information' });
    if (infoStr === undefined) {
        return;
    }
    const info: ConnectionInfo = JSON.parse(infoStr);
    setBlenderConnectionInfo(info);
    const ownAddress = `localhost:${communication.getServerPort()}`;
    communication.sendCommand('/set_vscode_address', ownAddress);
}

communication.registerRequestCommand('/set_connection_info', setBlenderConnectionInfo);

async function COMMAND_quitBlender() {
    communication.sendCommand('/quit');
}

interface BlenderExecutableConfig {
    path: string;
};

async function getBlenderExecutablePath() {
    const config = vscode.workspace.getConfiguration('blender');
    const executables = config.get<BlenderExecutableConfig[]>('executables')!;
    for (const executable of executables) {
        return executable.path;
    }

    let value = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: 'Blender Executable',
    });
    if (value === undefined) {
        return Promise.reject();
    }

    let filepath = value[0].fsPath;
    if (os.platform() === 'darwin') {
        if (filepath.toLowerCase().endsWith('.app')) {
            filepath += '/Contents/MacOS/blender';
        }
    }
    config.update('executables', [{ path: filepath }], vscode.ConfigurationTarget.Global);
    return filepath;
}

async function launchBlender(launchEnv: { [key: string]: string } = {}) {
    const blenderPath = await getBlenderExecutablePath();
    const launchPath = path.join(srcPath, 'launch.py');

    const task = new vscode.Task(
        { type: 'blender' },
        vscode.TaskScope.Global,
        'blender',
        'blender',
        new vscode.ProcessExecution(
            blenderPath,
            ['--python', launchPath],
            { env: launchEnv },
        ),
        []);
    vscode.tasks.executeTask(task);
}

async function COMMAND_start() {
    launchBlender({
        VSCODE_ADDRESS: `localhost:${communication.getServerPort()}`,
    });
}

async function COMMAND_startAndAttachPythonDebugger() {
    launchBlender({
        VSCODE_ADDRESS: `localhost:${communication.getServerPort()}`,
        WANT_TO_ATTACH_PYTHON_DEBUGGER: '',
    });
}

async function COMMAND_manageExecutables() {
    vscode.commands.executeCommand('workbench.action.openSettings', 'blender.executables');
}

interface AddonFolderInfo {
    initFile: string;
    addonName: string;
}

async function findAddons() {
    const addons: AddonFolderInfo[] = [];
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (workspaceFolders === undefined) {
        return [];
    }

    for (const workspaceFolder of workspaceFolders) {
        const rootDir = workspaceFolder.uri.fsPath;

        const pathsToCheck = await glob('**/*.py', {
            cwd: rootDir,
            suppressErrors: true,
            absolute: true,
        });

        for (const pathToCheck of pathsToCheck) {
            const text = await fsReadFile(pathToCheck, 'utf8');
            const addonName = tryExtractAddonName(text);
            if (addonName !== undefined) {
                addons.push({
                    initFile: pathToCheck,
                    addonName: addonName,
                })
            }
        }
    }

    return addons;
}

function tryExtractAddonName(text: string): string | undefined {
    for (const line of text.split(/\r?\n/)) {
        const match = line.match(/\s*["']name["']\s*:\s*["'](.*)["']\s*,/);
        if (match === null) {
            continue;
        }
        const addonName = match[1];
        return addonName
    }
    return undefined;
}

async function findAddonNames() {
    return (await findAddons()).map(addon => addon.addonName);
}

async function COMMAND_reloadAddon() {
    const addonNames = await findAddonNames();
    communication.sendCommand('/reload_addons', addonNames);
}

async function COMMAND_newAddon() {
    const addonType = await quick_pick.letUserPickString(['Simple', 'With Auto Load']);
    const folderPath = await getFolderForNewAddon();
    const folderName = path.basename(folderPath);
    if (!isValidPythonModuleName(folderName)) {
        throw errors.userError('The folder name should be a valid python identifier.');
    }

    const initPath = path.join(folderPath, '__init__.py');

    if (addonType === 'Simple') {
        fsCopyFile(
            path.join(templatesDir, 'simple_init.py'),
            initPath);
    }
    else if (addonType === 'With Auto Load') {
        fsCopyFile(
            path.join(templatesDir, 'auto_load_init.py'),
            initPath);
        fsCopyFile(
            path.join(srcPath, 'blender_vscode_addon', 'auto_load.py'),
            path.join(folderPath, 'auto_load.py'));
    }

    await vscode.window.showTextDocument(vscode.Uri.file(initPath));
    await vscode.commands.executeCommand('cursorBottom');
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(folderPath));
}

async function getFolderForNewAddon() {
    const items = [];
    if (vscode.workspace.workspaceFolders !== undefined) {
        for (const workspaceFolder of vscode.workspace.workspaceFolders) {
            const folderPath = workspaceFolder.uri.fsPath;
            if (await canCreateAddonInFolder(folderPath)) {
                items.push({ data: async () => folderPath, label: folderPath });
            }
        }
    }

    if (items.length > 0) {
        items.push({ data: selectFolderForAddon, label: 'Open Folder...' });
        const item = await quick_pick.letUserPickItem(items);
        return await item.data();
    }
    return await selectFolderForAddon();
}

async function selectFolderForAddon() {
    const value = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'New Addon',
    });
    if (value === undefined) {
        return Promise.reject(errors.cancel());
    }
    const folderPath = value[0].fsPath;
    if (!await canCreateAddonInFolder(folderPath)) {
        return Promise.reject(errors.userError(
            'Cannot create a new addon in this folder, because there are other files already.'
        ));
    }
    return folderPath;
}

async function canCreateAddonInFolder(folderPath: string) {
    return new Promise<boolean>(resolve => {
        fs.stat(folderPath, async (err, stat) => {
            if (err != null) {
                resolve(false);
                return;
            }
            if (!stat.isDirectory()) {
                resolve(false);
                return;
            }

            const files = await fsReadDir(folderPath);
            for (const name of files) {
                if (!name.startsWith('.')) {
                    resolve(false);
                    return;
                }
            }
            resolve(true);
        });
    });
}

function isValidPythonModuleName(text: string) {
    let match = text.match(/^[_a-z][_0-9a-z]*$/i);
    return match !== null;
}
