import * as vscode from 'vscode';
import { getConfig } from './utils';
import { BlenderExecutable, BlenderExecutableSettings } from './blender_executable';

export function factoryShowNotificationAddDefault(context: vscode.ExtensionContext) {
    return async function showNotificationAddDefault(
        executable: BlenderExecutable
    ) {
        // context.globalState.update('showNotificationAddDefault', undefined);
        const show = context.globalState.get('showNotificationAddDefault');
        if (show == false) {
            return
        }

        const choice = await vscode.window.showInformationMessage(
            `Make "${executable.data.name}" default?\n\`${executable.data.path}\``,
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
                if (setting.path == executable.data.path) {
                    setting.isDefault = true
                    matchFound = true
                }
            }

            if (matchFound === false) {
                toSave.push({
                    name: executable.data.name,
                    path: executable.data.path,
                    isDefault: true
                })
            }

            config.update('executables', toSave, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`"${executable.data.name}" is now default. Use settings \`blender.executables\` to change that.`);
        }
    }
}