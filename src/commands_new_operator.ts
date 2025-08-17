import * as vscode from 'vscode';
import * as path from 'path';
import { templateFilesDir } from './paths';
import {
    cancel, nameToClassIdentifier, nameToIdentifier, readTextFile,
    multiReplaceText
} from './utils';

export async function COMMAND_newOperator(): Promise<void> {
    let editor = vscode.window.activeTextEditor;
    if (editor === undefined) return;

    let operatorName = await vscode.window.showInputBox({
        placeHolder: 'Name',
    });
    if (operatorName === undefined) return Promise.reject(cancel());

    let group: string = 'object';
    await insertOperator(editor, operatorName, group);
}

async function insertOperator(editor: vscode.TextEditor, name: string, group: string) {
    let className = nameToClassIdentifier(name) + 'Operator';
    let idname = group + '.' + nameToIdentifier(name);

    let text = await readTextFile(path.join(templateFilesDir, 'operator_simple.py'));
    text = multiReplaceText(text, {
        CLASS_NAME: className,
        OPERATOR_CLASS: 'bpy.types.Operator',
        IDNAME: idname,
        LABEL: name,
    });

    let workspaceEdit = new vscode.WorkspaceEdit();

    if (!hasImportBpy(editor.document)) {
        workspaceEdit.insert(editor.document.uri, new vscode.Position(0, 0), 'import bpy\n');
    }

    workspaceEdit.replace(editor.document.uri, editor.selection, '\n' + text + '\n');
    await vscode.workspace.applyEdit(workspaceEdit);
}

function hasImportBpy(document: vscode.TextDocument) {
    for (let i = 0; i< document.lineCount; i++) {
        let line = document.lineAt(i);
        if (line.text.match(/import.*\bbpy\b/)) {
            return true;
        }
    }
    return false;
}