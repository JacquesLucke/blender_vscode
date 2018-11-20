'use strict';
import * as path from 'path';

import * as vscode from 'vscode';
import * as communication from './communication';
import * as paths from './paths';
import * as utils from './utils';

export function activate(context: vscode.ExtensionContext) {
    let commands : [string, () => Promise<void>][] = [
        ['blender.startBlender', COMMAND_startBlender],
        ['blender.newAddon',     require('./new_addon').COMMAND_newAddon],
        ['blender.launchAddon',  COMMAND_launchAddon],
        ['blender.updateAddon',  COMMAND_updateAddon],
    ];

    let disposables = [
        vscode.workspace.onDidSaveTextDocument(HANDLER_updateOnSave),
        vscode.tasks.onDidEndTask(HANDLER_taskEnds),
    ];

    for (let [identifier, func] of commands) {
        let command = vscode.commands.registerCommand(identifier, utils.handleErrors(func));
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
    await utils.startBlender();
}

async function COMMAND_launchAddon() {
    let blenderPath = await paths.getBlenderPath();
    await launchAddon(blenderPath, utils.getWorkspaceFolders()[0].uri.fsPath);
}

async function COMMAND_updateAddon() {
    vscode.workspace.saveAll(false);
    communication.sendToAllBlenderPorts({type: 'update'});
}

/* Event Handlers
 ***************************************/

function HANDLER_updateOnSave(document : vscode.TextDocument) {
    if (utils.getConfiguration().get('updateOnSave')) {
        COMMAND_updateAddon();
    }
}

function HANDLER_taskEnds(e : vscode.TaskEndEvent) {
    let identifier = e.execution.task.definition.type;
    communication.unregisterBlenderPort(identifier);
}


async function launchAddon(blenderPath : string, launchDirectory : string) {
    let pyLaunchPath = path.join(paths.pythonFilesDir, 'launch_external.py');

    await utils.startBlender(
        ['--python', pyLaunchPath],
        {
            ADDON_DEV_DIR: launchDirectory,
            DEBUGGER_PORT: communication.getServerPort(),
            PIP_PATH: paths.pipPath,
        }
    );
}