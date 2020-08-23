import * as request from 'request';

let blenderDevelopmentPort: number | null = null;

export function setDevelopmentPort(port: number | null) {
    blenderDevelopmentPort = port;
}

export function sendCommand(requestName: string, requestArg: any = null) {
    if (blenderDevelopmentPort === null) {
        return;
    }

    const requestData = {
        request_name: requestName,
        request_arg: requestArg,
    };
    request.post(`http://localhost:${blenderDevelopmentPort}`, { json: requestData });
}
