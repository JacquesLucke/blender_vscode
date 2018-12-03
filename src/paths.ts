import { join, dirname } from 'path';

const mainDir = dirname(__dirname);
export const pythonFilesDir = join(mainDir, 'pythonFiles');
export const templateFilesDir = join(pythonFilesDir, 'templates');
export const generatedDir = join(mainDir, 'generated');
