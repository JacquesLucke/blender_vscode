import * as path from 'path';
import * as vscode from 'vscode';
import { templateFilesDir } from './paths';
import { nameToIdentifier, nameToClassIdentifier, readTextFile } from './utils';

export async function insertTemplate(data : any) {
    try {
        if (data.type === 'newOperator') {
            let settings = new OperatorSettings(data.name, data.group);
            insertTemplate_SimpleOperator(settings);
        } else if (data.type === 'newPanel') {
            let settings = new PanelSettings(data.name, data.spaceType, data.regionType, data.group);
            insertTemplate_Panel(settings);
        }
    }
    catch (err) {
        vscode.window.showErrorMessage(`Could not insert template (${err.message}).`);
    }
}

/* Operator insertion
 **************************************/

class OperatorSettings {
    name : string;
    group : string;

    constructor(name : string, group : string) {
        this.name = name;
        this.group = group;
    }

    getIdName() {
        return `${this.group}.${nameToIdentifier(this.name)}`;
    }

    getClassName() {
        return nameToClassIdentifier(this.name) + 'Operator';
    }
}

async function insertTemplate_SimpleOperator(settings : OperatorSettings) {
    let sourcePath = path.join(templateFilesDir, 'operator_simple.py');
    let text = await readTextFile(sourcePath);
    text = text.replace('LABEL', settings.name);
    text = text.replace('OPERATOR_CLASS', 'bpy.types.Operator');
    text = text.replace('IDNAME', settings.getIdName());
    text = text.replace('CLASS_NAME', settings.getClassName());
    insertTextBlock(text);
}


/* Panel Insertion
**************************************/

class PanelSettings {
    name : string;
    spaceType : string;
    regionType : string;
    group : string;

    constructor(name : string, spaceType : string, regionType : string, group : string) {
        this.name = name;
        this.spaceType = spaceType;
        this.regionType = regionType;
        this.group = group;
    }

    getIdName() {
        return `${this.group}_PT_${nameToIdentifier(this.name)}`;
    }

    getClassName() {
        return nameToClassIdentifier(this.name) + 'Panel';
    }
}

async function insertTemplate_Panel(settings : PanelSettings) {
    let sourcePath = path.join(templateFilesDir, 'panel_simple.py');
    let text = await readTextFile(sourcePath);
    text = text.replace('LABEL', settings.name);
    text = text.replace('PANEL_CLASS', 'bpy.types.Panel');
    text = text.replace('SPACE_TYPE', settings.spaceType);
    text = text.replace('REGION_TYPE', settings.regionType);
    text = text.replace('CLASS_NAME', settings.getClassName());
    text = text.replace('IDNAME', settings.getIdName());
    insertTextBlock(text);
}

/* Text Block insertion
 **************************************/

function insertTextBlock(text : string) {
    let editor = vscode.window.activeTextEditor;
    if (editor === undefined) throw new Error('No active text editor.');

    let endLine = findNextLineStartingInTheBeginning(editor.document, editor.selection.start.line + 1);
    let startLine = findLastLineContainingText(editor.document, endLine - 1);

    let position = new vscode.Position(startLine, editor.document.lineAt(startLine).text.length);
    let range = new vscode.Range(position, position);

    let textEdit = new vscode.TextEdit(range, '\n\n\n' + text);
    let workspaceEdit = new vscode.WorkspaceEdit();
    workspaceEdit.set(editor.document.uri, [textEdit]);
    vscode.workspace.applyEdit(workspaceEdit);
}

function findNextLineStartingInTheBeginning(document : vscode.TextDocument, start : number) : number {
    for (let i = start; i < document.lineCount; i++) {
        let line = document.lineAt(i);
        if (line.text.length > 0 &&line.firstNonWhitespaceCharacterIndex === 0) {
            return i;
        }
    }
    return document.lineCount;
}

function findLastLineContainingText(document : vscode.TextDocument, start : number ) : number {
    for (let i = start; i >= 0; i--) {
        let line = document.lineAt(i);
        if (!line.isEmptyOrWhitespace) {
            return i;
        }
    }
    return 0;
}