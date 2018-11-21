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
        ['blender.buildAddon',  COMMAND_buildAddon],
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
    await COMMAND_buildAddon();
    let addonDirectory = getAddonDirectory();
    await startBlenderWithAddons(blenderPath, [addonDirectory]);
}

async function COMMAND_updateAddon() {
    vscode.workspace.saveAll(false);
    await COMMAND_buildAddon();
    communication.sendToAllBlenderPorts({type: 'update'});
}

async function COMMAND_buildAddon() {
    let config = utils.getConfiguration();
    let taskName = config.get('addonBuildTask');
    if (taskName !== '') {
        await vscode.commands.executeCommand('workbench.action.tasks.runTask', taskName);
        return new Promise<void>(resolve => {
            let disposable = vscode.tasks.onDidEndTask(e => {
                if (e.execution.task.name === taskName) {
                    disposable.dispose();
                    resolve();
                }
            });
        });
    }
    return Promise.resolve();
}


/* Event Handlers
 ***************************************/

function HANDLER_updateOnSave(document : vscode.TextDocument) {
    if (utils.getConfiguration().get('reloadAddonOnSave')) {
        COMMAND_updateAddon();
    }
}

function HANDLER_taskEnds(e : vscode.TaskEndEvent) {
    let identifier = e.execution.task.definition.type;
    communication.unregisterBlenderPort(identifier);
}

function getAddonDirectory() {
    let addonDirectory = <string>utils.getConfiguration().get('addonDirectory');
    if (path.isAbsolute(addonDirectory)) {
        return addonDirectory;
    } else {
        return path.join(utils.getWorkspaceFolders()[0].uri.fsPath, addonDirectory);
    }
}

async function startBlenderWithAddons(blenderPath : string, addonDirectories : string[]) {
    let config = utils.getConfiguration();

    await utils.startBlender(
        ['--python', paths.launchPath],
        {
            ADDON_DIRECTORIES_TO_LOAD: JSON.stringify(addonDirectories),
            EDITOR_PORT: communication.getServerPort(),
            PIP_PATH: paths.pipPath,
            ALLOW_MODIFY_EXTERNAL_PYTHON: <boolean>config.get('allowModifyExternalPython'),
        }
    );
}