import * as http from 'http';
import * as vscode from 'vscode';
import * as request from 'request';
import * as paths from './paths';
import { attachPythonDebugger } from './python_debugging';
import { insertTemplate } from './template_insertion';

var server : any = undefined;
let blenderPorts : any = {};

export function startServer() {
    server = http.createServer(SERVER_handleRequest);
    server.listen();
}

export function stopServer() {
    server.close();
}

export function registerBlenderPort(identifier : string, port : number) {
    blenderPorts[identifier] = port;
}

export function unregisterBlenderPort(identifier : string) {
    if (blenderPorts.hasOwnProperty(identifier)) {
        delete blenderPorts[identifier];
    }
}

export function getServerPort() : number {
    return server.address().port;
}

export function sendToAllBlenderPorts(data : any) {
    for (let property in blenderPorts) {
        if (blenderPorts.hasOwnProperty(property)) {
            request.post(`http://localhost:${blenderPorts[property]}`, {json: data});
        }
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
                    registerBlenderPort(req.identifier, req.blenderPort);
                    attachPythonDebugger(req.debugPort, [paths.getAddonPathMapping()]);
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