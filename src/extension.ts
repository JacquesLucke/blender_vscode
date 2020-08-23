import * as vscode from 'vscode';
import * as os from 'os';
import * as communication from './communication';
import * as path from 'path';
import * as python_debugging from './python_debugging';

export function activate(context: vscode.ExtensionContext) {
    const commands: [string, () => Promise<void>][] = [
        ['blender.connect', COMMAND_connect],
        ['blender.quit', COMMAND_quitBlender],
        ['blender.start', COMMAND_start],
        ['blender.attachPythonDebugger', python_debugging.COMMAND_attachPythonDebugger],
        ['blender.startAndAttachPythonDebugger', COMMAND_startAndAttachPythonDebugger],
        ['blender.manageExecutables', COMMAND_manageExecutables],
    ];

    for (const [identifier, func] of commands) {
        context.subscriptions.push(vscode.commands.registerCommand(identifier, func));
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
    const launchPath = path.join(path.dirname(__dirname), 'src', 'launch.py');

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
