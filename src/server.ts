import * as http from 'http';

var server: any = null;

export function ensureServer(): number {
    if (server === null) {
        server = http.createServer(handleRequest);
        server.listen();
    }
    return server.address().port;
}

export function stopServer() {
    server?.close();
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
