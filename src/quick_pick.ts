import * as vscode from 'vscode';
import * as errors from './errors';

export interface PickItem {
    data?: any;
    label: string;
    description?: string;
    detail?: string;
}

export async function letUserPickString(strings: string[], placeholder?: string): Promise<string> {
    const items = strings.map(str => ({ label: str }));
    const item = await letUserPickItem(items, placeholder);
    return item.label;
}

export async function letUserPickItem(items: PickItem[], placeholder?: string): Promise<PickItem> {
    let quickPick = vscode.window.createQuickPick();
    quickPick.items = items;
    quickPick.placeholder = placeholder;

    return new Promise<PickItem>((resolve, reject) => {
        quickPick.onDidAccept(() => {
            resolve(quickPick.activeItems[0]);
            quickPick.hide();
        });
        quickPick.onDidHide(() => {
            reject(errors.cancel());
            quickPick.dispose();
        });
        quickPick.show();
    });
}
