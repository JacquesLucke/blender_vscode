import * as http from 'http';
import * as vscode from 'vscode';
import * as request from 'request';
import { attachPythonDebuggerToBlender } from './python_debugging';
import { insertTemplate } from './template_insertion';

var server : any = undefined;
let blenderPorts : number[] = [];

export function startServer() {
    server = http.createServer(SERVER_handleRequest);
    server.listen();
}

export function stopServer() {
    server.close();
}

export function registerBlenderPort(port : number) {
    blenderPorts.push(port);
}

export function unregisterBlenderPort(port : number) {
    blenderPorts.splice(blenderPorts.indexOf(port), 1);
}

export function getServerPort() : number {
    return server.address().port;
}

export function sendToAllBlenderPorts(data : any) {
    for (let port of blenderPorts) {
        let req = request.post(`http://localhost:${port}`, {json:data, timeout:10});
        req.on('error', err => {
            unregisterBlenderPort(port);
        });
    }
}

function SERVER_handleRequest(request : any, response : any) {
    if (request.method === 'POST') {
        let body = '';
        request.on('data', (chunk : any) => body += chunk.toString());
        request.on('end', () => {
            let req = JSON.parse(body);

            switch (req.type) {
                case 'setup': {
                    registerBlenderPort(req.blenderPort);
                    attachPythonDebuggerToBlender(req.debugPort, req.blenderPath, req.scriptsFolder);
                    response.end('OK');
                    break;
                }
                case 'insertTemplate': {
                    insertTemplate(req.data);
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