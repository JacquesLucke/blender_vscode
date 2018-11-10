'use strict';

import * as vscode from 'vscode';
var path = require('path');
var fs = require('fs');
const { exec } = require('child_process');

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('b3ddev.startBlender', () => {
        findAndUpdateBlenderPath(blenderPath => {
            exec(blenderPath);
        });
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
}

function getConfiguration() {
    return vscode.workspace.getConfiguration('b3ddev')
}

function getConfigBlenderPath() {
    return getConfiguration().get('blenderPath');
}

function setConfigBlenderPath(path : string) {
    getConfiguration().update('blenderPath', path);
}

function testIfPathIsBlender(filepath : string, callback : (isValid : boolean) => void) {
    let name : string = path.basename(filepath);

    if (name.toLowerCase().startsWith('blender')) {
        let testString = '###TEST_BLENDER###';
        exec(`${filepath} -b --python-expr "import sys;print('${testString}');sys.stdout.flush();sys.exit()"`, {},
            (error : Error, stdout : string | Buffer, stderr : string | Buffer) => {
                let text = stdout.toString();
                callback(text.includes(testString));
            });
    } else {
        callback(false);
    }
}

function findAndUpdateBlenderPath(whenFound : (path : string) => void) {
    let originalPath = getConfigBlenderPath();
    fs.stat(originalPath, (err: Error, stat: any) => {
        if (err === null && typeof originalPath === 'string') {
            whenFound(originalPath);
        } else {
            vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                openLabel: 'Blender Executable'
            }).then(value => {
                if (value !== undefined) {
                    let filepath = value[0].path;
                    testIfPathIsBlender(filepath, is_valid => {
                        if (is_valid) {
                            setConfigBlenderPath(filepath);
                            whenFound(filepath);
                        } else {
                            vscode.window.showErrorMessage('Not a valid Blender executable.');
                        }
                    });
                }
            });

        }
    });
}