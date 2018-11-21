export function nameToIdentifier(name : string) {
    return name.toLowerCase().replace(/\W+/, '_');
}

export function nameToClassIdentifier(name : string) {
    let parts = name.split(/\W+/);
    let result = '';
    let allowNumber = false;
    for (let part of parts) {
        if (part.length > 0 && (allowNumber || !startsWithNumber(part))) {
            result += part.charAt(0).toUpperCase() + part.slice(1);
            allowNumber = true;
        }
    }
    return result;
}

export function startsWithNumber(text : string) {
    return text.charAt(0).match(/[0-9]/) !== null;
}