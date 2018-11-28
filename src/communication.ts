import * as http from 'http';
import * as vscode from 'vscode';
import * as request from 'request';
import { attachPythonDebuggerToBlender } from './python_debugging';

var server: any = undefined;
let blenderPorts: number[] = [];

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

export function sendToBlender(data: any) {
    for (let port of blenderPorts) {
        let req = request.post(getAddress(port), { json: data });
        req.on('error', () => {
            unregisterBlenderPort(port);
        });
    }
}

export async function isAnyBlenderConnected() {
    return new Promise<boolean>(resolve => {
        if (blenderPorts.length === 0) {
            resolve(false);
            return;
        }

        let sendAmount = blenderPorts.length;
        let errorAmount = 0;

        for (let port of blenderPorts) {
            let req = request.get(getAddress(port), { json: { type: 'ping' } });
            req.on('end', () => {
                resolve(true);
            });
            req.on('error', () => {
                unregisterBlenderPort(port);
                errorAmount += 1;
                if (errorAmount === sendAmount) {
                    resolve(false);
                }
            });
        }
    });
}


function SERVER_handleRequest(request: any, response: any) {
    if (request.method === 'POST') {
        let body = '';
        request.on('data', (chunk: any) => body += chunk.toString());
        request.on('end', () => {
            let req = JSON.parse(body);

            switch (req.type) {
                case 'setup': {
                    registerBlenderPort(req.blenderPort);
                    attachPythonDebuggerToBlender(req.ptvsdPort, req.blenderPath, req.scriptsFolder, req.addonPathMappings);
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

function registerBlenderPort(port: number) {
    blenderPorts.push(port);
}

function unregisterBlenderPort(port: number) {
    blenderPorts.splice(blenderPorts.indexOf(port), 1);
}

function getAddress(port: number) {
    return `http://localhost:${port}`;
}
