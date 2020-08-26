import * as vscode from 'vscode';

const CANCEL = 'CANCEL';

export function cancel() {
    return new Error(CANCEL);
}

export function userError(message: string) {
    return new Error(message);
}

export function catchAndShowErrors(func: () => Promise<void>) {
    return async () => {
        try {
            await func();
        }
        catch (err) {
            if (err.message !== CANCEL) {
                vscode.window.showErrorMessage(err.message);
            }
        }
    };
}
