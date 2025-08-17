import * as path from 'path';
import { generatedDir } from './paths';
import { readTextFile } from './utils';

let enumsPath = path.join(generatedDir, 'enums.json');

interface EnumItem {
    identifier: string;
    name: string;
    description: string;
}

export async function getAreaTypeItems() {
    return getGeneratedEnumData('areaTypeItems');
}

async function getGeneratedEnumData(identifier: string): Promise<EnumItem[]> {
    let text = await readTextFile(enumsPath);
    let data = JSON.parse(text);
    return data[identifier];
}
