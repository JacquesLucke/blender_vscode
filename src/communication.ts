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
    // debugpyPort: number;
    // justMyCode: boolean;
    // path: string;
    // scriptsFolder: string;
    // addonPathMappings: AddonPathMapping[];
    connectionErrors: Error[];

    constructor(blenderPort: number) {
        this.blenderPort = blenderPort;
        this.connectionErrors = [];
    }


    post(data: object): void {
        request.post(this.address, { json: data });
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

    attachDebugger(debugpyPort: number, justMyCode: boolean, path: string, scriptsFolder: string, addonPathMappings: AddonPathMapping[]) {
        attachPythonDebuggerToBlender(debugpyPort, path, justMyCode, scriptsFolder, addonPathMappings);
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

    getBlenderInstance(blenderPort: number): BlenderInstance | undefined {
        for (const blenderInstance of this.instances) {
            if (blenderInstance.blenderPort == blenderPort)
                return blenderInstance;
        }
        return undefined;
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
        for (let instance of this.instances) {
            instance.isResponsive(timeout).then(responsive => {
                if (responsive) instance.post(data);
            }).catch();
        }
    }

    sendToAll(data: object) {
        for (let instance of this.instances) {
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

function SERVER_handleRequest(request: any, response: http.ServerResponse) {
    if (request.method === 'GET') {
        let body = '';
        request.on('data', (chunk: any) => body += chunk.toString());
        request.on('end', () => {
            let req = JSON.parse(body);

            switch (req.type) {
                case 'setting': {
                    let config = getConfig();
                    let settingValue: any = config.get(req.name)
                    response.end('OK');
                    RunningBlenders.sendToResponsive({ type: "setting", name: req.name, value: settingValue.toString() })
                }
            }
        })
    } else if (request.method === 'POST') {
        let body = '';
        request.on('data', (chunk: any) => body += chunk.toString());
        request.on('end', () => {
            let req = JSON.parse(body);

            switch (req.type) {
                case 'setupFlask': {
                    let instance = new BlenderInstance(req.blenderPort)
                    RunningBlenders.register(instance);
                    response.end('OK');
                    break;
                }
                case 'setupDebugpy': {
                    let config = getConfig();
                    let instance = RunningBlenders.getBlenderInstance(req.blenderPort)
                    if (instance == undefined) {
                        console.error("Can not find blender instance!")
                    }
                    let justMyCode: boolean = <boolean>config.get('addon.justMyCode')
                    instance?.attachDebugger(req.debugpyPort, justMyCode, req.blenderPath, req.scriptsFolder, req.addonPathMappings)
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