'use strict';

import * as vscode from 'vscode';
import { AddonWorkspaceFolder } from './addon_folder';
import { BlenderExecutableData, BlenderExecutableSettings, LaunchAny, LaunchAnyInteractive } from './blender_executable';
import { RunningBlenders, startServer, stopServer } from './communication';
import { COMMAND_newAddon } from './commands_new_addon';
import { COMMAND_newOperator } from './commands_new_operator';
import { factoryShowNotificationAddDefault } from './notifications';
import {
    COMMAND_newScript,
    COMMAND_openScriptsFolder,
    COMMAND_runScript,
    COMMAND_runScript_registerCleanup,
    COMMAND_setScriptContext
} from './commands_scripts';
import { getDefaultBlenderSettings, handleErrors } from './utils';

export let outputChannel: vscode.OutputChannel;


/* Registration
 *********************************************/

export let showNotificationAddDefault: (executable: BlenderExecutableData) => Promise<void>


export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel("Blender debugpy");
    outputChannel.appendLine("Addon starting.");
    outputChannel.show(true);
    type CommandFuncType = (args?: any) => Promise<void | vscode.TaskExecution>
    let commands: [string, CommandFuncType][] = [
        ['blender.start', COMMAND_start],
        ['blender.stop', COMMAND_stop],
        ['blender.reloadAddons', COMMAND_reloadAddons],
        ['blender.newAddon', COMMAND_newAddon],
        ['blender.newScript', COMMAND_newScript],
        ['blender.openScriptsFolder', COMMAND_openScriptsFolder],
        ['blender.openFiles', COMMAND_openFiles],
        ['blender.openWithBlender', COMMAND_openWithBlender],
        ['blender.runScript', COMMAND_runScript],
        ['blender.setScriptContext', COMMAND_setScriptContext],
        ['blender.newOperator', COMMAND_newOperator],
    ];

    let disposables = [
        vscode.workspace.onDidSaveTextDocument(HANDLER_updateOnSave),
    ];

    for (const [identifier, func] of commands) {
        const command = vscode.commands.registerCommand(identifier, handleErrors(func));
        disposables.push(command);
    }
    disposables.push(...COMMAND_runScript_registerCleanup())

    context.subscriptions.push(...disposables);
    showNotificationAddDefault = factoryShowNotificationAddDefault(context)
    startServer();
}

export function deactivate() {
    stopServer();
}


/* Commands
 *********************************************/

export type StartCommandArguments = {
    blenderExecutable?: BlenderExecutableSettings;
    blendFilepaths?: string[]
    // run python script after degugger is attached
    script?: string
    // additionalArguments?: string[]; // support someday
}

export async function COMMAND_start(args?: StartCommandArguments) {
    let blenderToRun = getDefaultBlenderSettings()
    let filePaths: string[] | undefined = undefined
    let script: string | undefined = undefined
    if (args !== undefined) {
        script = args.script
        if (args.blenderExecutable !== undefined) {
            if (args.blenderExecutable.path !== undefined) {
                blenderToRun = args.blenderExecutable
            }
            filePaths = args.blendFilepaths
        }
    }

    if (blenderToRun === undefined) {
        await LaunchAnyInteractive(filePaths, script)
    } else {
        await LaunchAny(blenderToRun, filePaths, script)
    }
}

async function COMMAND_openWithBlender(resource: vscode.Uri) {
    const args: StartCommandArguments = {
        blendFilepaths: [resource.fsPath]
    }
    COMMAND_start(args);
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
    const args: StartCommandArguments = {
        blendFilepaths: resources.map(r => r.fsPath)
    }
    COMMAND_start(args);
}

async function COMMAND_stop() {
    RunningBlenders.sendToAll({ type: 'stop' });
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
    instances.forEach((instance) => {
        void instance.post({ type: 'reload', names: names, dirs: dirs }).catch((error) => {
            instance.connectionErrors.push(error instanceof Error ? error : new Error(String(error)));
        });
    });
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
