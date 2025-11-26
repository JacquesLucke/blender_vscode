import * as http from 'http';
import * as vscode from 'vscode';
import axios, { AxiosResponse } from 'axios';
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

    async post(data: object): Promise<AxiosResponse> {
        try {
            return await axios.post(this.address, data);
        } catch (err: any) {
            this.connectionErrors.push(err);
            throw err;
        }
    }

    async ping(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                const response = await axios.get(`${this.address}/ping`, {
                    headers: { 'Content-Type': 'application/json' },
                    // responseType: 'text',
                });
                // you can access response.data if needed, it's plain text
                resolve(response.data);
            } catch (err: any) {
                this.connectionErrors.push(err);
                reject(err);
            }
        });
        try {
            await axios.get(this.address, {
                headers: { 'Content-Type': 'application/json' },
                params: { type: 'ping' },
                responseType: 'text'
            },
            );
        } catch (err: any) {
            console.log(err.message);
            this.connectionErrors.push(err);
            throw err;
        }
    }

    async isResponsive(timeout: number = RESPONSIVE_LIMIT_MS): Promise<boolean> {
        return new Promise<boolean>(async (resolve) => {
            await this.ping() // todo does not really need await?
                .then(() => resolve(true))
                .catch(() => resolve(false));
            setTimeout(() => resolve(false), timeout);
        });
    }

    attachDebugger() {
        this.debug_session = attachPythonDebuggerToBlender(
            this.debugpyPort,
            this.path,
            this.justMyCode,
            this.scriptsFolder,
            this.addonPathMappings,
            this.vscodeIdentifier
        );
        return this.debug_session;
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
        this.tasks.push(task);
    }

    public getTask(vscodeIdentifier: string): BlenderTask | undefined {
        return this.tasks.find(item => item.vscodeIdentifier === vscodeIdentifier);
    }

    public async kill(vscodeIdentifier: string) {
        const task = this.getTask(vscodeIdentifier);
        task?.task.terminate();
        this.tasks = this.tasks.filter(item => item.vscodeIdentifier !== vscodeIdentifier);
        this.instances = this.instances.filter(item => item.vscodeIdentifier !== vscodeIdentifier);
    }

    async getResponsive(timeout: number = RESPONSIVE_LIMIT_MS): Promise<BlenderInstance[]> {
        if (this.instances.length === 0) return [];

        return new Promise<BlenderInstance[]>(async resolve => {
            const responsiveInstances: BlenderInstance[] = [];
            const pingAmount = this.instances.length;

            const addInstance = (instance: BlenderInstance) => {
                responsiveInstances.push(instance);
                if (responsiveInstances.length === pingAmount) {
                    resolve([...responsiveInstances]);
                }
            };

            for (const instance of this.instances) {
                await instance.ping().then(() => addInstance(instance)).catch(() => { }); // todo does not really need await?
            }

            setTimeout(() => resolve([...responsiveInstances]), timeout);
        });
    }

    async sendToResponsive(data: object, timeout: number = RESPONSIVE_LIMIT_MS) {
        const sentTo: Promise<AxiosResponse>[] = [];
        for (const instance of this.instances) {
            const isResponsive = await instance.isResponsive(timeout);
            if (!isResponsive) continue;

            try {
                sentTo.push(instance.post(data));
            } catch { }
        }
        return sentTo;
    }

    async sendToAll(data: object) {
        for (const instance of this.instances) {
            await instance.post(data); // todo does not really need await?
        }
    }
}


/* Own server
 ********************************************** */

let server: http.Server | undefined;

export function startServer() {
    server = http.createServer(SERVER_handleRequest);
    server.listen();
}

export function stopServer() {
    server?.close();
}

export function getServerPort(): number {
    if (!server) throw new Error('Server not started');
    return (server.address() as any).port;
}

async function SERVER_handleRequest(request: any, response: any) {
    if (request.method === 'POST') {
        let body = '';
        request.on('data', (chunk: any) => body += chunk.toString());
        request.on('end', () => {
            const req = JSON.parse(body);

            switch (req.type) {
                case 'setup': {
                    const config = getConfig();
                    const justMyCode: boolean = <boolean>config.get('addon.justMyCode');
                    const instance = new BlenderInstance(
                        req.blenderPort,
                        req.debugpyPort,
                        justMyCode,
                        req.blenderPath,
                        req.scriptsFolder,
                        req.addonPathMappings,
                        req.vscodeIdentifier
                    );
                    response.end('OK');
                    instance.attachDebugger().then(() => {
                        RunningBlenders.registerInstance(instance);
                        RunningBlenders.getTask(instance.vscodeIdentifier)?.onStartDebugging();
                    });
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

export const RunningBlenders = new RunningBlenderInstances();