import * as path from 'path';

/* Constant paths
 *********************************************/

export const pythonFilesDir = path.join(path.dirname(path.dirname(__dirname)), 'pythonFiles');
export const templateFilesDir = path.join(pythonFilesDir, 'templates');
export const pipPath = path.join(pythonFilesDir, 'get-pip.py');
export const launchPath = path.join(pythonFilesDir, 'launch.py');
