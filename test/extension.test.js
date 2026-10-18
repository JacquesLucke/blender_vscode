const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test, mock } = require('node:test');
const vm = require('node:vm');

// Load the compiled entrypoint with isolated dependencies, without a VS Code host
// or a Blender process. Exercise the callbacks registered by activate().
function loadExtension(defaultExecutable, resources) {
    const commands = new Map();
    const launch = mock.fn(async () => {});
    const launchInteractive = mock.fn(async () => {});
    const showOpenDialog = mock.fn(async () => resources);
    const noop = () => {};
    const dependencies = {
        vscode: {
            window: {
                createOutputChannel: () => ({ appendLine: noop, show: noop }),
                showOpenDialog,
            },
            workspace: { onDidSaveTextDocument: noop },
            commands: {
                registerCommand: (name, callback) => commands.set(name, callback),
            },
        },
        './addon_folder': {},
        './blender_executable': { LaunchAny: launch, LaunchAnyInteractive: launchInteractive },
        './communication': { startServer: noop },
        './commands_new_addon': { COMMAND_newAddon: noop },
        './commands_new_operator': { COMMAND_newOperator: noop },
        './notifications': { factoryShowNotificationAddDefault: () => noop },
        './commands_scripts': {
            COMMAND_newScript: noop,
            COMMAND_openScriptsFolder: noop,
            COMMAND_runScript: noop,
            COMMAND_runScript_registerCleanup: () => [],
            COMMAND_setScriptContext: noop,
        },
        './utils': {
            getDefaultBlenderSettings: () => defaultExecutable,
            handleErrors: callback => callback,
        },
    };
    const filename = path.join(__dirname, '../out/extension.js');
    const source = fs.readFileSync(filename, 'utf8');
    const module = { exports: {} };
    const load = vm.runInThisContext(
        `(function (require, module, exports) { ${source}\n})`, { filename }
    );
    load(name => {
        assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
        return dependencies[name];
    }, module, module.exports);
    module.exports.activate({ subscriptions: [] });
    return { commands, launch, launchInteractive, showOpenDialog };
}

const defaultExecutable = { path: 'C:/Blender/blender.exe', isDefault: true };
const files = ['C:/Projects/Scene One.blend', 'C:/Projects/Scene Two.blend'];

for (const executable of [defaultExecutable, undefined]) {
    const mode = executable ? 'default executable' : 'interactive selection';

    function assertLaunch(extension, filepaths, script, expectedExecutable = executable) {
        const selected = expectedExecutable ? extension.launch : extension.launchInteractive;
        const unused = expectedExecutable ? extension.launchInteractive : extension.launch;
        assert.equal(selected.mock.callCount(), 1);
        assert.equal(unused.mock.callCount(), 0);
        const expected = expectedExecutable
            ? [expectedExecutable, filepaths, script] : [filepaths, script];
        assert.deepEqual(selected.mock.calls[0].arguments, expected);
    }

    test(`Open With Blender forwards the selected file with ${mode}`, async () => {
        const extension = loadExtension(executable);
        await extension.commands.get('blender.openWithBlender')({ fsPath: files[0] });
        assertLaunch(extension, [files[0]], undefined);
    });

    test(`Open File(s) forwards multiple paths with spaces with ${mode}`, async () => {
        const extension = loadExtension(executable, files.map(fsPath => ({ fsPath })));
        await extension.commands.get('blender.openFiles')();
        assertLaunch(extension, files, undefined);
        assert.equal(extension.showOpenDialog.mock.callCount(), 1);
        assert.equal(extension.showOpenDialog.mock.calls[0].arguments[0].canSelectMany, true);
    });

    test(`Start forwards files and script without an override with ${mode}`, async () => {
        const extension = loadExtension(executable);
        await extension.commands.get('blender.start')({ blendFilepaths: files, script: 'print(42)' });
        assertLaunch(extension, files, 'print(42)');
    });

    test(`Start preserves an explicit executable and script with ${mode}`, async () => {
        const extension = loadExtension(executable);
        const override = { path: 'C:/Other Blender/blender.exe' };
        await extension.commands.get('blender.start')({
            blenderExecutable: override, blendFilepaths: files, script: 'print(42)',
        });
        assertLaunch(extension, files, 'print(42)', override);
    });

    test(`Start preserves selection for an override without a path with ${mode}`, async () => {
        const extension = loadExtension(executable);
        await extension.commands.get('blender.start')({ blenderExecutable: {}, blendFilepaths: files });
        assertLaunch(extension, files, undefined);
    });

    test(`Start without arguments preserves normal startup with ${mode}`, async () => {
        const extension = loadExtension(executable);
        await extension.commands.get('blender.start')();
        assertLaunch(extension, undefined, undefined);
    });

    test(`Start with empty arguments preserves normal startup with ${mode}`, async () => {
        const extension = loadExtension(executable);
        await extension.commands.get('blender.start')({});
        assertLaunch(extension, undefined, undefined);
    });
}
