import * as http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import * as vscode from 'vscode';
import axios from 'axios';
import { getConfig } from './utils';
import { attachPythonDebuggerToBlender } from './python_debugging';
import { BlenderTask } from './blender_executable';

const RESPONSIVE_LIMIT_MS = 1000;

type JsonPayload = Record<string, unknown>;


/* Manage connected Blender instances
 ********************************************** */

export type AddonPathMapping = { src: string, load: string };

export class BlenderInstance {
    public readonly blenderPort: number;
    public readonly debugpyPort: number;
    public readonly justMyCode: boolean;
    public readonly path: string;
    public readonly scriptsFolder: string;
    public readonly addonPathMappings: AddonPathMapping[];
    public readonly connectionErrors: Error[];
    public readonly vscodeIdentifier: string; // can identify VS Code task and in HTTP communication

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

    async post(data: JsonPayload): Promise<void> {
        await axios.post(this.address, data);
    }

    async ping(): Promise<void> {
        try {
            await axios.get(`${this.address}/ping`);
        } catch (error) {
            this.connectionErrors.push(error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    async isResponsive(timeout: number = RESPONSIVE_LIMIT_MS): Promise<boolean> {
        const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout));
        try {
            await Promise.race([this.ping(), timeoutPromise]);
            return true;
        } catch {
            return false;
        }
    }

    attachDebugger(): Thenable<boolean> {
        return attachPythonDebuggerToBlender(this.debugpyPort, this.path, this.justMyCode, this.scriptsFolder, this.addonPathMappings, this.vscodeIdentifier);
    }

    get address(): string {
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

    registerInstance(instance: BlenderInstance): void {
        this.instances = this.instances.filter(item => item.vscodeIdentifier !== instance.vscodeIdentifier);
        this.instances.push(instance);
    }
    registerTask(task: BlenderTask): void {
        this.tasks.push(task);
    }

    public getTask(vscodeIdentifier: string): BlenderTask | undefined {
        return this.tasks.find(item => item.vscodeIdentifier === vscodeIdentifier);
    }
    public getInstance(vscodeIdentifier: string): BlenderInstance | undefined {
        return this.instances.find(item => item.vscodeIdentifier === vscodeIdentifier);
    }

    public kill(vscodeIdentifier: string): void {
        const task = this.getTask(vscodeIdentifier);
        task?.task.terminate();
        this.tasks = this.tasks.filter(item => item.vscodeIdentifier !== vscodeIdentifier);
        this.instances = this.instances.filter(item => item.vscodeIdentifier !== vscodeIdentifier);
    }

    /** Blender with alive and responsive web server is considered running.
     * Note: no response might be caused by CPU usage or active breakpoint in debugger.
     */
    async getResponsive(timeout: number = RESPONSIVE_LIMIT_MS): Promise<BlenderInstance[]> {
        if (this.instances.length === 0) {
            return [];
        }

        const responsiveness = await Promise.all(this.instances.map(instance => instance.isResponsive(timeout)));
        return this.instances.filter((_, index) => responsiveness[index]);
    }

    /** There is no direct way to check if process is alive.
     * The correctness is guaranteed by correct cleanup in kill method.
     */
    getAlive(): BlenderInstance[] {
        return this.instances;
    }

    async sendToResponsive(data: JsonPayload, timeout: number = RESPONSIVE_LIMIT_MS): Promise<void> {
        const responsiveness = await Promise.all(this.instances.map(instance => instance.isResponsive(timeout)));
        const pending: Promise<void>[] = [];

        for (let index = 0; index < this.instances.length; index++) {
            if (!responsiveness[index]) {
                continue;
            }

            const instance = this.instances[index];
            try {
                const promise = instance.post(data).catch((error) => {
                    instance.connectionErrors.push(error instanceof Error ? error : new Error(String(error)));
                });
                pending.push(promise);
            } catch (error) {
                instance.connectionErrors.push(error instanceof Error ? error : new Error(String(error)));
            }
        }

        await Promise.all(pending);
    }

    sendToAll(data: JsonPayload): void {
        for (const instance of this.instances) {
            try {
                void instance.post(data).catch((error) => {
                    instance.connectionErrors.push(error instanceof Error ? error : new Error(String(error)));
                });
            } catch (error) {
                instance.connectionErrors.push(error instanceof Error ? error : new Error(String(error)));
            }
        }
    }
}


/* Own server
 ********************************************** */

export function startServer(): void {
    if (server) {
        return;
    }

    server = http.createServer(handleRequest);
    server.listen();
}

export function stopServer(): void {
    if (!server) {
        return;
    }

    server.close();
    server = undefined;
}

export function getServerPort(): number {
    if (!server) {
        throw new Error('Server has not been started.');
    }

    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Server address is not available.');
    }

    return address.port;
}

function handleRequest(request: IncomingMessage, response: ServerResponse): void {
    if (request.method !== 'POST') {
        response.writeHead(405).end('Method Not Allowed');
        return;
    }

    const chunks: Buffer[] = [];
    request.on('data', chunk => {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });

    request.on('error', () => {
        if (!response.writableEnded) {
            response.writeHead(500).end('Error receiving data');
        }
    });

    request.on('end', () => {
        if (response.writableEnded) {
            return;
        }
        const body = Buffer.concat(chunks).toString();
        let payload: JsonPayload;
        try {
            payload = JSON.parse(body);
        } catch {
            response.writeHead(400).end('Invalid JSON');
            return;
        }

        const type = typeof payload.type === 'string' ? payload.type : '';

        switch (type) {
            case 'setup': {
                const config = getConfig();
                const blenderPort = Number(payload.blenderPort);
                const debugpyPort = Number(payload.debugpyPort);
                const blenderPath = typeof payload.blenderPath === 'string' ? payload.blenderPath : '';
                const scriptsFolder = typeof payload.scriptsFolder === 'string' ? payload.scriptsFolder : '';
                const vscodeIdentifier = typeof payload.vscodeIdentifier === 'string' ? payload.vscodeIdentifier : '';

                if (!Number.isFinite(blenderPort) || !Number.isFinite(debugpyPort) || blenderPath === '' || scriptsFolder === '' || vscodeIdentifier === '') {
                    response.writeHead(400).end('Invalid setup payload');
                    return;
                }

                const addonPathMappings = Array.isArray(payload.addonPathMappings)
                    ? (payload.addonPathMappings as AddonPathMapping[]).filter(item => typeof item?.src === 'string' && typeof item?.load === 'string')
                    : [];
                const justMyCode = Boolean(config.get('addon.justMyCode'));
                const instance = new BlenderInstance(blenderPort, debugpyPort, justMyCode, blenderPath, scriptsFolder, addonPathMappings, vscodeIdentifier);
                response.end('OK');

                const attachResult = instance.attachDebugger();
                Promise.resolve(attachResult)
                    .then(() => {
                        RunningBlenders.registerInstance(instance);
                        RunningBlenders.getTask(instance.vscodeIdentifier)?.onStartDebugging();
                    })
                    .catch((error: unknown) => {
                        instance.connectionErrors.push(error instanceof Error ? error : new Error(String(error)));
                        vscode.window.showErrorMessage('Failed to attach debugger to Blender instance.');
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
                response.writeHead(400).end('Unknown type');
            }
        }
    });
}

let server: http.Server | undefined;
export const RunningBlenders = new RunningBlenderInstances();