import { join, dirname } from 'path';

const mainDir = dirname(__dirname);
export const pythonFilesDir = join(mainDir, 'pythonFiles');
export const templateFilesDir = join(pythonFilesDir, 'templates');
export const launchPath = join(pythonFilesDir, 'launch.py');
export const generatedDir = join(__dirname, 'generated');
