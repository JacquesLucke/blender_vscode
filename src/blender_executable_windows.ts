import * as path from 'path';
import * as fs from 'fs';


async function getDirectories(path_: string): Promise<string[]> {
    const entries = await fs.promises.readdir(path_);

    const directories: string[] = [];
    for (const name of entries) {
        const stats = await fs.promises.stat(path.join(path_, name));
        if (stats.isDirectory()) {
            directories.push(name);
        }
    }

    return directories;
}

// todo read from registry Blender installation path
const typicalWindowsBlenderFoundationPaths: string[] = [
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Blender Foundation"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Blender Foundation"),
];


export async function getBlenderWindows(): Promise<string[]> {
    const blenders: string[] = [];
    const dirsToCheck: string[] = [];
    for (const typicalPath of typicalWindowsBlenderFoundationPaths) {
        const dirs = await getDirectories(typicalPath).catch((err: NodeJS.ErrnoException) => []);
        dirsToCheck.push(...dirs.map(dir => path.join(typicalPath, dir)));
    }

    const exe = "blender.exe";
    for (const folder of dirsToCheck) {
        const executable = path.join(folder, exe);
        const stats = await fs.promises.stat(executable).catch((err: NodeJS.ErrnoException) => undefined);
        if (stats === undefined) {
            continue;
        }
        if (stats.isFile()) {
            blenders.push(executable);
        }
    }

    return blenders;
}