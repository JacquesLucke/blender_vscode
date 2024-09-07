import * as vscode from 'vscode';
// i lost this entire file. F** great.

const BlenderCompletionProvider = {
    async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
        console.log("triggered competion")
        const simpleCompletion = new vscode.CompletionItem('Hello World!');
        return new Promise<vscode.CompletionItem[]>((resolve, reject) => resolve([simpleCompletion])).then(ok => ok)
    }
}

export function completionProvider() {
    return vscode.languages.registerCompletionItemProvider(['python', 'plaintext'], BlenderCompletionProvider, '')
}