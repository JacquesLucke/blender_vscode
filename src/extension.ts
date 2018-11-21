'use strict';

import * as vscode from 'vscode';
import * as communication from './communication';
import * as paths from './paths';
import * as utils from './utils';

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

async function COMMAND_launchAll() {
    await COMMAND_buildAll();
    let blenderFolder = await getBlenderWorkspaceFolder();
    if (blenderFolder === null) {
        let blenderPath = await paths.getBlenderPath();
        let addonFolders = await getAddonWorkspaceFolders();
        let addonLoadDirectories = addonFolders.map(f => paths.getAddonLoadDirectory(f.uri));
        startBlenderWithAddons(blenderPath, addonLoadDirectories);
    } else {
        launchBlenderWithDebugger(blenderFolder);
    }
}

async function launchBlenderWithDebugger(folder : vscode.WorkspaceFolder) {
    let addonData = await getStartAddonsData();

    let configuation = {
        name: 'Debug Blender',
        type: 'cppdbg',
        request: 'launch',
        program: '/home/jacques/blender-git/build_linux_debug/bin/blender',
        args: ['--debug'].concat(addonData.args),
        env: addonData.env,
        stopAtEntry: false,
        MIMode: 'gdb',
        cwd: folder.uri.fsPath,
    };
    vscode.debug.startDebugging(folder, configuation);
}

async function getBlenderWorkspaceFolder() {
    for (let folder of utils.getWorkspaceFolders()) {
        if (await utils.folderIsBlender(folder)) {
            return folder;
        }
    }
    return null;
}

async function getAddonWorkspaceFolders() {
    let folders = [];
    for (let folder of utils.getWorkspaceFolders()) {
        if (await utils.folderIsAddon(folder)) {
            folders.push(folder);
        }
    }
    return folders;
}

async function COMMAND_buildAll() {
    await buildWorkspaceFolders(utils.getWorkspaceFolders());
}

async function buildWorkspaceFolders(folders : vscode.WorkspaceFolder[]) {
    let promises = [];
    for (let folder of folders) {
        if (await utils.folderIsAddon(folder)) {
            promises.push(buildAddon(folder));
        } else if (await utils.folderIsBlender(folder)) {
            promises.push(buildBlender(folder));
        }
    }
    return Promise.all(promises);
}

async function buildAddon(folder : vscode.WorkspaceFolder) {
    let config = utils.getConfiguration(folder.uri);
    let taskName = <string>config.get('addonBuildTask');
    if (taskName === '') return Promise.resolve();

    await vscode.commands.executeCommand('workbench.action.tasks.runTask', taskName);
    await utils.waitUntilTaskEnds(taskName);
}

async function buildBlender(folder : vscode.WorkspaceFolder) {
    let config = utils.getConfiguration(folder.uri);
    let buildCommand = <string>config.get('blenderBuildCommand');

    await utils.startShellCommand(buildCommand, folder);
    await utils.waitUntilTaskEnds(buildCommand);
}

async function COMMAND_reloadAddons() {
    let addonFolders = await getAddonWorkspaceFolders();
    await buildWorkspaceFolders(addonFolders);
    communication.sendToAllBlenderPorts({type: 'update'});
}


/* Event Handlers
 ***************************************/

function HANDLER_updateOnSave(document : vscode.TextDocument) {
    if (utils.getConfiguration().get('reloadAddonOnSave')) {
        COMMAND_reloadAddons();
    }
}

async function startBlenderWithAddons(blenderPath : string, addonDirectories : string[]) {
    let data = await getStartAddonsData();
    await utils.startBlender(data.args, data.env);
}

async function getStartAddonsData() {
    let config = utils.getConfiguration();
    let folders = await getAddonWorkspaceFolders();
    let loadDirs = folders.map(f => paths.getAddonLoadDirectory(f.uri));

    return {
        args: ['--python', paths.launchPath],
        env: {
            ADDON_DIRECTORIES_TO_LOAD: JSON.stringify(loadDirs),
            EDITOR_PORT: communication.getServerPort(),
            PIP_PATH: paths.pipPath,
            ALLOW_MODIFY_EXTERNAL_PYTHON: <boolean>config.get('allowModifyExternalPython') ? 'yes' : 'no',
        }
    };
}