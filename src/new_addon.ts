import * as vscode from 'vscode';
import * as utils from './utils';
import * as paths from './paths';
import * as path from 'path';
import * as fs from 'fs';

export async function COMMAND_newAddon() {
    let workspaceFolders = utils.getWorkspaceFolders();
    if (workspaceFolders.length === 0) {
        let value = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'New Addon'});
        if (value === undefined) return;
        await tryMakeAddonInFolder(value[0].fsPath, true);
    } else if (workspaceFolders.length === 1) {
        await tryMakeAddonInFolder(workspaceFolders[0].uri.fsPath);
    } else {
        throw new Error('Can\'t create a new addon in a workspace with multiple folders yet.');
    }
}

async function tryMakeAddonInFolder(folderPath : string, openWorkspace : boolean = false) {
    await testIfAddonCanBeCreatedInFolder(folderPath);
    let [addonName, authorName] = await askUser_SettingsForNewAddon();
    await createNewAddon(folderPath, addonName, authorName);
    await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(folderPath));
}

async function testIfAddonCanBeCreatedInFolder(folder : string) {
    return new Promise<void>((resolve, reject) => {
        fs.stat(folder, (err, stat) => {
            if (err !== null) throw new Error('Error when accesing the folder.');
            if (!stat.isDirectory()) throw new Error('Not a directory.');

            fs.readdir(folder, {}, (err, files) => {
                for (let name of files) {
                    if (!(<string>name).startsWith('.')) {
                        throw new Error('The folder already contains some files.');
                    }
                }
                resolve();
            });
        });
    });
}

async function askUser_SettingsForNewAddon() {
    let addonName = await vscode.window.showInputBox({placeHolder: 'Addon Name'});
    if (addonName === undefined) {
        throw utils.cancel();
    } else if (addonName === "") {
        throw new Error('Can\'t create an addon without a name.');
    }

    let authorName = await vscode.window.showInputBox({placeHolder: 'Your Name'});
    if (authorName === undefined) {
        throw utils.cancel();
    } else if (authorName === "") {
        throw new Error('Can\'t create an addon without an author name.');
    }

    return [<string>addonName, <string>authorName];
}

async function createNewAddon(folder : string, addonName : string, authorName : string) {
    let initSourcePath = path.join(paths.templateFilesDir, 'addon.py');
    let initTargetPath = path.join(folder, "__init__.py");
    let text = await utils.readTextFile(initSourcePath);
    text = text.replace('ADDON_NAME', addonName);
    text = text.replace('AUTHOR_NAME', authorName);

    return new Promise<string>((resolve, reject) => {
        fs.writeFile(initTargetPath, text, (err : Error) => {
            if (err !== null) {
                throw new Error('Could not create the __init__.py file.');
            } else {
                resolve(initTargetPath);
            }
        });
    });
}