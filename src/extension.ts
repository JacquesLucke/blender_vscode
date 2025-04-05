'use strict';

import * as vscode from 'vscode';
import { handleCommandErrors, handleFileExplorerCommandErrors } from './utils';
import { COMMAND_newAddon } from './new_addon';
import { COMMAND_newOperator } from './new_operator';
import { AddonWorkspaceFolder } from './addon_folder';
import { BlenderExecutable } from './blender_executable';
import { BlenderWorkspaceFolder } from './blender_folder';
import { startServer, stopServer, RunningBlenders } from './communication';
import {
    COMMAND_runScript, COMMAND_newScript, COMMAND_setScriptContext,
    COMMAND_openScriptsFolder
} from './scripts';

export let outputChannel: vscode.OutputChannel;


/* Registration
 *********************************************/

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel("Blender debugpy");
    outputChannel.appendLine("Addon starting.");
    outputChannel.show(true);

    let commands: [string, () => Promise<void>][] = [
        ['blender.stop', COMMAND_stop],
        ['blender.build', COMMAND_build],
        ['blender.buildAndStart', COMMAND_buildAndStart],
        ['blender.startWithoutCDebugger', COMMAND_startWithoutCDebugger],
        ['blender.buildPythonApiDocs', COMMAND_buildPythonApiDocs],
        ['blender.reloadAddons', COMMAND_reloadAddons],
        ['blender.newAddon', COMMAND_newAddon],
        ['blender.newScript', COMMAND_newScript],
        ['blender.openScriptsFolder', COMMAND_openScriptsFolder],
        ['blender.openFiles', COMMAND_openFiles],
    ];

    let textEditorCommands: [string, () => Promise<void>][] = [
        ['blender.runScript', COMMAND_runScript],
        ['blender.setScriptContext', COMMAND_setScriptContext],
        ['blender.newOperator', COMMAND_newOperator],
    ];

    let fileExplorerCommands: [string, (resource: vscode.Uri) => Promise<void>][] = [
        ['blender.openWithBlender', COMMAND_openWithBlender],
    ];

    let disposables = [
        vscode.workspace.onDidSaveTextDocument(HANDLER_updateOnSave),
    ];

    for (const [identifier, func] of commands) {
        const command = vscode.commands.registerCommand(identifier, handleCommandErrors(func));
        disposables.push(command);
    }

    for (const [identifier, func] of textEditorCommands) {
        const command = vscode.commands.registerTextEditorCommand(identifier, handleCommandErrors(func));
        disposables.push(command);
    }

    for (const [identifier, func] of fileExplorerCommands) {
        const command = vscode.commands.registerCommand(identifier, handleFileExplorerCommandErrors(func));
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
    await COMMAND_start(undefined);
}


type StartCommandArguments = {
    additionalArguments?: string[];
    path?: string;
}

async function COMMAND_start() {
    startBlender();
}

async function COMMAND_openWithBlender(resource: vscode.Uri) {
    startBlender([resource.fsPath]);
}

async function COMMAND_openFiles() {
    let resources = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: true,
        filters: { 'Blender files': ['blend'] },
        openLabel: "Select .blend file(s)"
    });
    if (resources === undefined) {
        return Promise.reject(new Error('No .blend file selected.'));
    }
    startBlender(resources.map(r => r.fsPath));
}

async function startBlender(blend_filepaths?: string[]) {
    let blenderFolder = await BlenderWorkspaceFolder.Get();
    if (blenderFolder === null) {
        await BlenderExecutable.LaunchAny(blend_filepaths);
    }
    else {
        await BlenderExecutable.LaunchDebug(blenderFolder, blend_filepaths);
    }
}

async function COMMAND_stop() {
    RunningBlenders.sendToAll({ type: 'stop' });
}

async function COMMAND_build() {
    await rebuildAddons(await AddonWorkspaceFolder.All());

    let blenderFolder = await BlenderWorkspaceFolder.Get();
    if (blenderFolder !== null) {
        await blenderFolder.buildDebug();
    }
}

async function COMMAND_startWithoutCDebugger() {
    await BlenderExecutable.LaunchAnyInteractive();
}

async function COMMAND_buildPythonApiDocs() {
    let folder = await BlenderWorkspaceFolder.Get();
    if (folder === null) {
        vscode.window.showInformationMessage('Cannot generate API docs without Blender source code.');
        return;
    }
    let part = await vscode.window.showInputBox({ placeHolder: 'part' });
    if (part === undefined) return;
    await folder.buildPythonDocs(part);
}

let isSavingForReload = false;

async function COMMAND_reloadAddons() {
    isSavingForReload = true;
    await vscode.workspace.saveAll(false);
    isSavingForReload = false;
    await reloadAddons(await AddonWorkspaceFolder.All());
}

async function reloadAddons(addons: AddonWorkspaceFolder[]) {
    if (addons.length === 0) return;
    let instances = await RunningBlenders.getResponsive();
    if (instances.length === 0) return;

    await rebuildAddons(addons);
    let names = await Promise.all(addons.map(a => a.getModuleName()));
    // Send source dirs so that the python script can determine if each addon is an extension or not.
    let dirs = await Promise.all(addons.map(a => a.getSourceDirectory()));
    instances.forEach(instance => instance.post({ type: 'reload', names: names, dirs: dirs }));
}

async function rebuildAddons(addons: AddonWorkspaceFolder[]) {
    await Promise.all(addons.map(a => a.buildIfNecessary()));
}


/* Event Handlers
 ***************************************/

async function HANDLER_updateOnSave(document: vscode.TextDocument) {
    if (isSavingForReload) return;
    let addons = await AddonWorkspaceFolder.All();
    await reloadAddons(addons.filter(a => a.reloadOnSave));
}
