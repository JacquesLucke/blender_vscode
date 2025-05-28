import * as path from 'path';
import * as vscode from 'vscode';
import { BlenderExecutable } from './blender_executable';
import { runTask, getConfig, getWorkspaceFolders, pathsExist } from './utils';

export class BlenderWorkspaceFolder {
    folder: vscode.WorkspaceFolder;

    constructor(folder: vscode.WorkspaceFolder) {
        this.folder = folder;
    }

    public static async Get() {
        for (let folder of getWorkspaceFolders()) {
            let blender = new BlenderWorkspaceFolder(folder);
            if (await blender.isValid()) {
                return blender;
            }
        }
        return null;
    }

    public async isValid() {
        let paths = ['doc', 'source', 'release'].map(n => path.join(this.uri.fsPath, n));
        return pathsExist(paths);
    }

    get uri() {
        return this.folder.uri;
    }

    public async buildPythonDocs(part: string | undefined = undefined) {
        let api_folder = path.join(this.uri.fsPath, 'doc', 'python_api');

        let args = [
            '--background',
            '--factory-startup',
            '--python',
            path.join(api_folder, 'sphinx_doc_gen.py'),
        ];

        if (part !== undefined) {
            args.push('--');
            args.push('--partial');
            args.push(part);
        }

        let blender = await BlenderExecutable.GetAnyInteractive();
        await blender.launchWithCustomArgs('build api docs', args);

        let execution = new vscode.ProcessExecution('sphinx-build', [
            path.join(api_folder, 'sphinx-in'),
            path.join(api_folder, 'sphinx-out'),
        ]);

        await runTask('generate html', execution, true);
    }

    public getConfig() {
        return getConfig(this.uri);
    }
}
