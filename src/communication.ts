import * as http from 'http';
import * as request from 'request';

/* Handle Incoming Requests
 ********************************************/

let ownServer: any = null;
type RequestHandler = (arg: any, response: http.ServerResponse) => void;
const requestHandlers = new Map<string, RequestHandler>();

function ensureServer(): number {
    if (ownServer === null) {
        ownServer = http.createServer(handleRequest);
        ownServer.listen();
    }
    return ownServer.address().port;
}

export function getServerPort(): number {
    return ensureServer();
}

export function stopServer() {
    ownServer?.close();
}

function handleRequest(request: http.IncomingMessage, response: http.ServerResponse) {
    if (request.method !== 'POST') {
        response.writeHead(400);
        response.end();
        return;
    }
    if (request.url === undefined) {
        response.writeHead(400);
        response.end();
        return;
    }

    let content_str = '';
    request.on('data', (chunk: any) => content_str += chunk.toString());
    request.on('end', () => {
        let content_json;
        try {
            content_json = JSON.parse(content_str);
        }
        catch (e) {
            console.log('Bad request: ' + content_str);
            response.writeHead(400);
            response.end();
            return;
        }
        const handler = requestHandlers.get(request.url!);
        if (handler === undefined) {
            response.writeHead(400);
            response.end();
            return;
        }
        handler(content_json, response);
        response.writeHead(200);
        response.write('This is a response');
        response.end();
    });
}

export function registerRequestHandler(requestPath: string, handler: RequestHandler) {
    requestHandlers.set(requestPath, handler);
}

export function registerRequestCommand(requestPath: string, command: (arg: any) => void) {
    registerRequestHandler(requestPath, (arg: any, response: http.ServerResponse) => {
        try {
            command(arg);
        }
        catch (e) {
            response.writeHead(400);
            response.end();
            return;
        }
        response.writeHead(200);
        response.end();
    });
}

/* Handle Outgoing Requests
 ********************************************/

let blenderAddress: string | null = null;

export function setBlenderAddress(address: string | null) {
    blenderAddress = address;
}

export function sendCommand(requestPath: string, requestArg: any = null) {
    if (blenderAddress === null) {
        return;
    }
    console.assert(requestPath.startsWith('/'));
    ensureServer();
    request.post(`http://${blenderAddress}${requestPath}`, { json: requestArg });
}
