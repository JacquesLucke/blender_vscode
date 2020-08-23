import * as http from 'http';
import * as request from 'request';

/* Handle Incoming Requests
 ********************************************/

let ownServer: any = null;

export function ensureServer(): number {
    if (ownServer === null) {
        ownServer = http.createServer(handleRequest);
        ownServer.listen();
    }
    return ownServer.address().port;
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

    let body = '';
    request.on('data', (chunk: any) => body += chunk.toString());
    request.on('end', () => {
        let request_data;
        try {
            request_data = JSON.parse(body);
        }
        catch (e) {
            console.log('Bad request: ' + body);
            response.writeHead(400);
            response.end();
            return;
        }
        console.log(request_data);
        response.writeHead(200);
        response.write('This is a response');
        response.end();
    });
}

/* Handle Outgoing Requests
 ********************************************/

let blenderAddress: string | null = null;

export function setBlenderAddress(address: string | null) {
    blenderAddress = address;
}

export function sendCommand(requestName: string, requestArg: any = null) {
    if (blenderAddress === null) {
        return;
    }

    const requestData = {
        request_name: requestName,
        request_arg: requestArg,
    };
    request.post(`http://${blenderAddress}`, { json: requestData });
}
