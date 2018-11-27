import * as vscode from 'vscode';
import { cancel } from './utils';

export interface PickItem {
    data?: any;
    label: string;
    description?: string;
}

export async function letUserPickItem(items: PickItem[]) : Promise<PickItem> {
    let quickPick = vscode.window.createQuickPick();
    quickPick.items = items;

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
