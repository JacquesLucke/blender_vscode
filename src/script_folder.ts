import * as vscode from 'vscode';
import { sendToBlender } from './communication';

export async function COMMAND_RunScript() {
    let editor = vscode.window.activeTextEditor;
    if (editor === undefined) return Promise.reject(new Error('no active script'));

    let document = editor.document;
    await document.save();
    sendToBlender({type: 'script', path: document.uri.fsPath});
    return Promise.resolve();
}
