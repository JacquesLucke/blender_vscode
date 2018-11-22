'use strict';

import * as vscode from 'vscode';
import * as communication from './communication';
import { handleErrors } from './utils/generic';
import { BlenderExecutable } from './blender_paths';
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
    await (await BlenderExecutable.GetAny()).launch();
}

async function COMMAND_launchAll() {
    await COMMAND_buildAll();

    let blender = await BlenderFolder.Get();
    if (blender === null) {
        await (await BlenderExecutable.GetAny()).launch();
    } else {
        await (await BlenderExecutable.GetDebug()).launchDebug(blender);
    }
}

async function COMMAND_buildAll() {
    let addons = await AddonFolder.All();
    await Promise.all(addons.map(a => a.buildIfNecessary()));

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

    await Promise.all(addonsToReload.map(a => a.buildIfNecessary()));
    let names = addonsToReload.map(a => a.name);
    communication.sendToAllBlenderPorts({type: 'reload', names: names});
}


/* Event Handlers
 ***************************************/

function HANDLER_updateOnSave(document : vscode.TextDocument) {
    COMMAND_reloadAddons();
}
