import { join, dirname } from 'path';

export const pythonFilesDir = join(dirname(__dirname), 'pythonFiles');
export const templateFilesDir = join(pythonFilesDir, 'templates');
export const launchPath = join(pythonFilesDir, 'launch.py');
