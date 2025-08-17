
import * as vscode from 'vscode';
import { RunningBlenders } from './communication';
import { removeCommonPrefixSuffix, guesFuncSignature } from './blender_completion_provider_utils';
import { getRandomString } from './utils';


export function blenderCompletionProvider() {
    const provider1 = vscode.languages.registerCompletionItemProvider('python', {
        async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken, _context: vscode.CompletionContext) {
            const line = document.lineAt(position.line);
            const requestData = {
                "type": "complete",
                "sessionId": getRandomString(),
                "line": line.text,
                "document": document.getText(),
                "current_line": position.line,
                "current_character": position.character,
            }
            const resultsToAwait = await RunningBlenders.sendGetToResponsive(requestData)
            const results = await Promise.allSettled(resultsToAwait);
            const items = results.filter(r => r.status === "fulfilled").map((r: PromiseFulfilledResult<any>) => r.value);

            const seen = new Set<string>();
            const deduplicatedItems: any[] = items.reduce((acc, responseBody) => {
                for (const item of responseBody.items) {
                    if (!seen.has(item.complete)) {
                        seen.add(item.complete)
                        acc.push(item)
                    }
                }
                return acc;
            }, [])

            return deduplicatedItems.map(item => {
                const complete = new vscode.CompletionItem(item.complete)
                complete.range = new vscode.Range(position, position);
                if (item.prefixToRemove !== undefined) {
                    complete.insertText = item.complete.substring(item.prefixToRemove.length)
                } else {
                    complete.insertText = removeCommonPrefixSuffix(item.complete, line.text)
                }
                if (item.description) {
                    complete.documentation = new vscode.MarkdownString(item.description.replace("\n", "\n\n"))
                }
                if (item.complete.endsWith('(') || item.complete.endsWith('()') ) {
                    complete.kind = vscode.CompletionItemKind.Function
                    let maybeFuncSignature;
                    if (item.complete.endsWith('()') ) {
                        complete.range = new vscode.Range(position, position.translate(0, 1));
                        maybeFuncSignature = guesFuncSignature(item.description.slice(0, -1))
                    } else {
                        maybeFuncSignature = guesFuncSignature(item.description)
                    }
                    complete.label = maybeFuncSignature
                    if (maybeFuncSignature) {
                        complete.insertText = removeCommonPrefixSuffix(maybeFuncSignature, line.text)
                    }
                    complete.sortText = '\0';
                }
                return complete
            });
        }
    },
        ".", "(", '[', '\'', '"', // trigger characters
    );
    return provider1
}