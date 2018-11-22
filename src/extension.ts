'use strict';

import * as vscode from 'vscode';
import { AddonFolder } from './addon_folder';
import { handleErrors } from './utils/generic';
import { COMMAND_newAddon } from './new_addon';
import { BlenderFolder } from './blender_folder';
import { BlenderExecutable } from './blender_executable';
import { startServer, stopServer, isAnyBlenderConnected, sendToAllBlenderPorts } from './communication';

export function activate(context: vscode.ExtensionContext) {
    let commands : [string, () => Promise<void>][] = [
        ['blender.start',         COMMAND_start],
        ['blender.build',         COMMAND_build],
        ['blender.buildAndStart', COMMAND_buildAndStart],
        ['blender.reloadAddons',  COMMAND_reloadAddons],
        ['blender.newAddon',      COMMAND_newAddon],
    ];

    let disposables = [
        vscode.workspace.onDidSaveTextDocument(HANDLER_updateOnSave),
    ];

    for (let [identifier, func] of commands) {
        let command = vscode.commands.registerCommand(identifier, handleErrors(func));
        disposables.push(command);
    }

    context.subscriptions.push(...disposables);

    startServer();
}

export function deactivate() {
    stopServer();
}


/* Commands
 *********************************************/

async function COMMAND_start() {
    await (await BlenderExecutable.GetAny()).launch();
}

async function COMMAND_buildAndStart() {
    await COMMAND_build();

    let blender = await BlenderFolder.Get();
    if (blender === null) {
        await (await BlenderExecutable.GetAny()).launch();
    } else {
        await (await BlenderExecutable.GetDebug()).launchDebug(blender);
    }
}

async function COMMAND_build() {
    await rebuildAddons(await AddonFolder.All());

    let blender = await BlenderFolder.Get();
    if (blender !== null) {
        await blender.buildDebug();
    }
}

async function COMMAND_reloadAddons() {
    await reloadAddons(await AddonFolder.All());
}

async function reloadAddons(addons : AddonFolder[]) {
    if (addons.length === 0) return;
    if (!(await isAnyBlenderConnected())) return;

    await rebuildAddons(addons);
    let names = addons.map(a => a.moduleName);
    sendToAllBlenderPorts({type: 'reload', names: names});
}

async function rebuildAddons(addons : AddonFolder[]) {
    await Promise.all(addons.map(a => a.buildIfNecessary()));
}


/* Event Handlers
 ***************************************/

async function HANDLER_updateOnSave(document : vscode.TextDocument) {
    let addons = await AddonFolder.All();
    await reloadAddons(addons.filter(a => a.reloadOnSave));
}
