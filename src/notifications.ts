import * as vscode from 'vscode';
import { getConfig } from './utils';
import { BlenderExecutableData, BlenderExecutableSettings } from './blender_executable';

export function factoryShowNotificationAddDefault(context: vscode.ExtensionContext) {
    return async function showNotificationAddDefault(executable : BlenderExecutableData
    ) {
        // context.globalState.update('showNotificationAddDefault', undefined);
        const show = context.globalState.get('showNotificationAddDefault');
        if (show == false) {
            return
        }

        const choice = await vscode.window.showInformationMessage(
            `Make "${executable.name}" default?\n\`${executable.path}\``,
            'Never show again',
            'Make default'
        );
        if (choice === 'Never show again') {
            context.globalState.update('showNotificationAddDefault', false);
        } else if (choice === 'Make default') {
            let config = getConfig();
            const settingsBlenderPaths = (<BlenderExecutableSettings[]>config.get('executables'));

            const toSave: BlenderExecutableSettings[] = settingsBlenderPaths.map(item => { return { 'name': item.name, 'path': item.path, 'isDefault': item.isDefault } })

            let matchFound = false
            for (const setting of toSave) {
                setting.isDefault = undefined
                if (setting.path == executable.path) {
                    setting.isDefault = true
                    matchFound = true
                }
            }

            if (matchFound === false) {
                toSave.push({
                    name: executable.name,
                    path: executable.path,
                    isDefault: true
                })
            }

            config.update('executables', toSave, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`"${executable.name}" is now default. Use settings \`blender.executables\` to change that.`);
        }
    }
}