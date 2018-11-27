'use strict';

import * as vscode from 'vscode';
import { AddonWorkspaceFolder } from './addon_folder';
import { handleErrors } from './utils';
import { COMMAND_newAddon } from './new_addon';
import { BlenderWorkspaceFolder } from './blender_folder';
import { BlenderExecutable } from './blender_executable';
import { startServer, stopServer, isAnyBlenderConnected, sendToBlender } from './communication';
import { COMMAND_runScript } from './scripts';

export function activate(context: vscode.ExtensionContext) {
    let commands: [string, () => Promise<void>][] = [
        ['blender.start', COMMAND_start],
        ['blender.build', COMMAND_build],
        ['blender.buildAndStart', COMMAND_buildAndStart],
        ['blender.startWithoutCDebugger', COMMAND_startWithoutCDebugger],
        ['blender.buildPythonApiDocs', COMMAND_buildPythonApiDocs],
        ['blender.reloadAddons', COMMAND_reloadAddons],
        ['blender.newAddon', COMMAND_newAddon],
        ['blender.runScript', COMMAND_runScript],
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

async function COMMAND_buildAndStart() {
    await COMMAND_build();
    await COMMAND_start();
}

async function COMMAND_start() {
    let blenderFolder = await BlenderWorkspaceFolder.Get();
    if (blenderFolder === null) {
        await BlenderExecutable.LaunchAny();
    }
    else {
        await BlenderExecutable.LaunchDebug(blenderFolder);
    }
}

async function COMMAND_build() {
    await rebuildAddons(await AddonWorkspaceFolder.All());

    let blenderFolder = await BlenderWorkspaceFolder.Get();
    if (blenderFolder !== null) {
        await blenderFolder.buildDebug();
    }
}

async function COMMAND_startWithoutCDebugger() {
    await BlenderExecutable.LaunchAny();
}

async function COMMAND_buildPythonApiDocs() {
    let folder = await BlenderWorkspaceFolder.Get();
    if (folder === null) {
        vscode.window.showInformationMessage('Cannot generate API docs without Blender source code.');
        return;
    }
    let part = await vscode.window.showInputBox({placeHolder: 'part'});
    if (part === undefined) return;
    await folder.buildPythonDocs(part);
}

async function COMMAND_reloadAddons() {
    await reloadAddons(await AddonWorkspaceFolder.All());
}

async function reloadAddons(addons: AddonWorkspaceFolder[]) {
    if (addons.length === 0) return;
    if (!(await isAnyBlenderConnected())) return;

    await rebuildAddons(addons);
    let names = addons.map(a => a.moduleName);
    sendToBlender({ type: 'reload', names: names });
}

async function rebuildAddons(addons: AddonWorkspaceFolder[]) {
    await Promise.all(addons.map(a => a.buildIfNecessary()));
}


/* Event Handlers
 ***************************************/

async function HANDLER_updateOnSave(document: vscode.TextDocument) {
    let addons = await AddonWorkspaceFolder.All();
    await reloadAddons(addons.filter(a => a.reloadOnSave));
}
