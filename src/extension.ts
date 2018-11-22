'use strict';

import * as vscode from 'vscode';
import * as communication from './communication';
import { startExternalProgram } from './utils/tasks';
import { handleErrors } from './utils/generic';
import * as paths from './utils/paths';
import * as utils from './utils/utils';
import { BlenderPaths } from './blender_paths';
import { AddonFolder } from './addon_folder';
import { BlenderFolder } from './blender_folder';

export function activate(context: vscode.ExtensionContext) {
    let commands : [string, () => Promise<void>][] = [
        ['blender.startBlender', COMMAND_startBlender],
        ['blender.newAddon',     require('./new_addon').COMMAND_newAddon],
        ['blender.launchAll',    COMMAND_launchAll],
        ['blender.buildAll',     COMMAND_buildAll],
        ['blender.reloadAddons', COMMAND_reloadAddons]
    ];

    let disposables = [
        vscode.workspace.onDidSaveTextDocument(HANDLER_updateOnSave),
    ];

    for (let [identifier, func] of commands) {
        let command = vscode.commands.registerCommand(identifier, handleErrors(func));
        disposables.push(command);
    }

    context.subscriptions.push(...disposables);

    communication.startServer();
}

export function deactivate() {
    communication.stopServer();
}


/* Commands
 *********************************************/

async function COMMAND_startBlender() {
    await startBlender();
}

export async function startBlender(args : string[] = [], additionalEnv : any = {}) {
    let blenderPath = await BlenderPaths.GetAny();
    return startExternalProgram(blenderPath, args, additionalEnv);
}

async function COMMAND_launchAll() {
    await COMMAND_buildAll();
    let blenderFolder = await utils.getBlenderWorkspaceFolder();
    if (blenderFolder === null) {
        await startBlenderWithAddons();
    } else {
        await launchBlenderWithDebugger(blenderFolder);
    }
}

async function launchBlenderWithDebugger(folder : vscode.WorkspaceFolder) {
    let launchData = await getBlenderLaunchData();
    let blenderPath = await BlenderPaths.GetDebug();

    let configuation = {
        name: 'Debug Blender',
        type: 'cppdbg',
        request: 'launch',
        program: blenderPath,
        args: ['--debug'].concat(launchData.args),
        env: launchData.env,
        stopAtEntry: false,
        MIMode: 'gdb',
        cwd: folder.uri.fsPath,
    };
    vscode.debug.startDebugging(folder, configuation);
}

async function COMMAND_buildAll() {
    let addons = await AddonFolder.All();
    await Promise.all(addons.map(a => a.build()));
    let blender = await BlenderFolder.Get();
    if (blender !== null) {
        await blender.buildDebug();
    }
}

async function COMMAND_reloadAddons() {
    let addons = await AddonFolder.All();
    let addonsToReload = addons.filter(a => a.reloadOnSave);

    if (addonsToReload.length === 0) return;
    if (!(await communication.isAnyBlenderConnected())) return;

    await Promise.all(addonsToReload.map(a => a.build()));
    let names = addonsToReload.map(a => a.name);
    communication.sendToAllBlenderPorts({type: 'reload', names: names});
}


/* Event Handlers
 ***************************************/

function HANDLER_updateOnSave(document : vscode.TextDocument) {
    COMMAND_reloadAddons();
}

async function startBlenderWithAddons() {
    let data = await getBlenderLaunchData();
    await startBlender(data.args, data.env);
}

interface BlenderLaunchData {
    args : string[];
    env : any;
}

async function getBlenderLaunchData() {
    let config = utils.getConfiguration();
    let addons = await AddonFolder.All();
    let loadDirs = addons.map(a => a.getLoadDirectory());

    return <BlenderLaunchData>{
        args: ['--python', paths.launchPath],
        env: {
            ADDON_DIRECTORIES_TO_LOAD: JSON.stringify(loadDirs),
            EDITOR_PORT: communication.getServerPort(),
            PIP_PATH: paths.pipPath,
            ALLOW_MODIFY_EXTERNAL_PYTHON: <boolean>config.get('allowModifyExternalPython') ? 'yes' : 'no',
        }
    };
}