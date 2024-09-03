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

    constructor(blenderPort: number, debugpyPort: number, justMyCode: boolean, path: string,
        scriptsFolder: string, addonPathMappings: AddonPathMapping[]) {
        this.blenderPort = blenderPort;
        this.debugpyPort = debugpyPort;
        this.justMyCode = justMyCode;
        this.path = path;
        this.scriptsFolder = scriptsFolder;
        this.addonPathMappings = addonPathMappings;
        this.connectionErrors = [];
    }

    post(data: object): void {
        request.post(this.address, { json: data });
    }

    get(data: object) {
        return request.get(this.address, { json: data });
    }

    async ping(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const req = request.get(this.address, { json: { type: 'ping' } });
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
        attachPythonDebuggerToBlender(this.debugpyPort, this.path, this.justMyCode, this.scriptsFolder, this.addonPathMappings);
    }

    get address() {
        return `http://localhost:${this.blenderPort}`;
    }
}

export class BlenderInstances {
    private instances: BlenderInstance[];

    constructor() {
        this.instances = [];
    }

    register(instance: BlenderInstance) {
        this.instances.push(instance);
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

    sendToResponsive(data: object, timeout: number = RESPONSIVE_LIMIT_MS) {
        for (const instance of this.instances) {
            instance.isResponsive(timeout).then(responsive => {
                if (responsive)
                    instance.post(data);
            }).catch();
        }
    }

    async getFromResponsive(params: object, timeout: number = RESPONSIVE_LIMIT_MS) {
        for (const instance of this.instances) {
            const isResponsive = await instance.isResponsive(timeout)
            if (!isResponsive)
                continue
            return instance.get(params);
        }
        return undefined;
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
                    let instance = new BlenderInstance(req.blenderPort, req.debugpyPort, justMyCode, req.blenderPath, req.scriptsFolder, req.addonPathMappings);
                    instance.attachDebugger();
                    RunningBlenders.register(instance);
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
export const RunningBlenders = new BlenderInstances();