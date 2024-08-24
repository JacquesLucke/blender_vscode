import * as vscode from 'vscode';
import { cancel } from './utils';
import { QuickPickItem } from 'vscode';
import { BlenderPathData } from './blender_executable';

export interface PickItem extends QuickPickItem {
    data?: any | (() => Promise<BlenderPathData>),
    label: string;
    description?: string;
    detail?: string;
}
export async function letUserPickItem(items: PickItem[], placeholder: undefined | string = undefined): Promise<PickItem> {
    let quickPick = vscode.window.createQuickPick();
    quickPick.items = items;
    quickPick.placeholder = placeholder;

    return new Promise<PickItem>((resolve, reject) => {
        quickPick.onDidAccept(() => {
            resolve(quickPick.activeItems[0]);
            quickPick.hide();
        });
        quickPick.onDidHide(() => {
            reject(cancel());
            quickPick.dispose();
        });
        quickPick.show();
    });
}
