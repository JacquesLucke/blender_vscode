import * as http from 'http';
import * as vscode from 'vscode';
import * as request from 'request';
import { getConfig } from './utils';
import { attachPythonDebuggerToBlender } from './python_debugging';

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
    vscodeIdentifier: string;

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
        return attachPythonDebuggerToBlender(this.debugpyPort, this.path, this.justMyCode, this.scriptsFolder, this.addonPathMappings, this.vscodeIdentifier);
    }

    get address() {
        return `http://localhost:${this.blenderPort}`;
    }
}

export class RunningBlenderInstances {
    protected instances: BlenderInstance[];
    protected onRegisterCallbacks: ((instance: BlenderInstance) => void)[];

    constructor() {
        this.instances = [];
        this.onRegisterCallbacks = [];
    }

    register(instance: BlenderInstance) {
        this.instances.push(instance);
        for (const onRegisterCallback of this.onRegisterCallbacks) {
            onRegisterCallback(instance)
        }
    }

    onRegister(callback: (instance: BlenderInstance) => void) {
        this.onRegisterCallbacks.push(callback);
    }

    clearOnRegisterCallbacks() {
        this.onRegisterCallbacks = []
    }

    clearInstances(predicate: (instance: BlenderInstance) => boolean) {
        this.instances.filter(predicate)
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
                    instance.attachDebugger().then(() => RunningBlenders.register(instance))
                    response.end('OK');
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

var server: any = undefined;
export const RunningBlenders = new RunningBlenderInstances();