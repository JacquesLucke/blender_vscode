import * as http from 'http';
import * as vscode from 'vscode';
import * as request from 'request';
import { getConfig } from './utils';
import { attachPythonDebuggerToBlender } from './python_debugging';
import { BlenderTask } from './blender_executable';

const RESPONSIVE_LIMIT_MS = 1000;


/* Manage connected Blender instances
 ********************************************** */

export type AddonPathMapping = { src: string, load: string };

export class BlenderInstance {
    blenderPort: number;
    debugpyPort: number;
    justMyCode: boolean;
    path: string;
    scriptsFolder: string;
    addonPathMappings: AddonPathMapping[];
    connectionErrors: Error[];
    vscodeIdentifier: string; // can identify vs code task and in http communication
    debug_session: any;

    constructor(blenderPort: number, debugpyPort: number, justMyCode: boolean, path: string,
        scriptsFolder: string, addonPathMappings: AddonPathMapping[], vscodeIdentifier: string) {
        this.blenderPort = blenderPort;
        this.debugpyPort = debugpyPort;
        this.justMyCode = justMyCode;
        this.path = path;
        this.scriptsFolder = scriptsFolder;
        this.addonPathMappings = addonPathMappings;
        this.connectionErrors = [];
        this.vscodeIdentifier = vscodeIdentifier;
    }

    post(data: object) {
        return request.post(this.address, { json: data });
    }

    async ping(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let req = request.get(this.address, { json: { type: 'ping' } });
            req.on('end', () => resolve());
            req.on('error', err => { this.connectionErrors.push(err); reject(err); });
        });
    }

    async isResponsive(timeout: number = RESPONSIVE_LIMIT_MS) {
        return new Promise<boolean>(resolve => {
            this.ping().then(() => resolve(true)).catch();
            setTimeout(() => resolve(false), timeout);
        });
    }

    attachDebugger() {
        this.debug_session = attachPythonDebuggerToBlender(this.debugpyPort, this.path, this.justMyCode, this.scriptsFolder, this.addonPathMappings, this.vscodeIdentifier);
        return this.debug_session
    }

    get address() {
        return `http://localhost:${this.blenderPort}`;
    }
}

export class RunningBlenderInstances {
    protected instances: BlenderInstance[];
    protected tasks: BlenderTask[];

    constructor() {
        this.instances = [];
        this.tasks = [];
    }

    registerInstance(instance: BlenderInstance) {
        this.instances.push(instance);
    }
    registerTask(task: BlenderTask) {
        this.tasks.push(task)
    }

    public getTask(vscodeIdentifier: string): BlenderTask | undefined {
        return this.tasks.filter(item => item.vscodeIdentifier === vscodeIdentifier)[0]
    }
    public getInstance(vscodeIdentifier: string): BlenderInstance | undefined {
        return this.instances.filter(item => item.vscodeIdentifier === vscodeIdentifier)[0]
    }

    public async kill(vscodeIdentifier: string) {
        const task = this.getTask(vscodeIdentifier)
        task?.task.terminate()
        this.tasks = this.tasks.filter(item => item.vscodeIdentifier !== vscodeIdentifier)

        // const instance = this.getInstance(vscodeIdentifier)
        this.instances = this.instances.filter(item => item.vscodeIdentifier !== vscodeIdentifier)
    }

    async getResponsive(timeout: number = RESPONSIVE_LIMIT_MS): Promise<BlenderInstance[]> {
        if (this.instances.length === 0) return [];

        return new Promise<BlenderInstance[]>(resolve => {
            let responsiveInstances: BlenderInstance[] = [];
            let pingAmount = this.instances.length;

            function addInstance(instance: BlenderInstance) {
                responsiveInstances.push(instance);
                if (responsiveInstances.length === pingAmount) {
                    resolve(responsiveInstances.slice());
                }
            }

            for (let instance of this.instances) {
                instance.ping().then(() => addInstance(instance)).catch(() => { });
            }
            setTimeout(() => resolve(responsiveInstances.slice()), timeout);
        });
    }

    async sendToResponsive(data: object, timeout: number = RESPONSIVE_LIMIT_MS) {
        let sentTo: request.Request[] = []
        for (const instance of this.instances) {
            const isResponsive = await instance.isResponsive(timeout)
            if (!isResponsive)
                continue
            try {
                sentTo.push(instance.post(data))
            } catch { }
        }
        return sentTo;
    }

    sendToAll(data: object) {
        for (const instance of this.instances) {
            instance.post(data);
        }
    }
}


/* Own server
 ********************************************** */

export function startServer() {
    server = http.createServer(SERVER_handleRequest);
    server.listen();
}

export function stopServer() {
    server.close();
}

export function getServerPort(): number {
    return server.address().port;
}

function SERVER_handleRequest(request: any, response: any) {
    if (request.method === 'POST') {
        let body = '';
        request.on('data', (chunk: any) => body += chunk.toString());
        request.on('end', () => {
            let req = JSON.parse(body);

            switch (req.type) {
                case 'setup': {
                    let config = getConfig();
                    let justMyCode: boolean = <boolean>config.get('addon.justMyCode')
                    let instance = new BlenderInstance(req.blenderPort, req.debugpyPort, justMyCode, req.blenderPath, req.scriptsFolder, req.addonPathMappings, req.vscodeIdentifier);
                    response.end('OK');
                    instance.attachDebugger().then(() => {
RunningBlenders.registerInstance(instance)
                        RunningBlenders.getTask(instance.vscodeIdentifier)?.onStartDebugging()

                    }
                    )
                    break;
                }
                case 'enableFailure': {
                    vscode.window.showWarningMessage('Enabling the addon failed. See console.');
                    response.end('OK');
                    break;
                }
                case 'disableFailure': {
                    vscode.window.showWarningMessage('Disabling the addon failed. See console.');
                    response.end('OK');
                    break;
                }
                case 'addonUpdated': {
                    response.end('OK');
                    break;
                }
                default: {
                    throw new Error('unknown type');
                }
            }
        });
    }
}

var server: http.Server | any = undefined;
export const RunningBlenders = new RunningBlenderInstances();