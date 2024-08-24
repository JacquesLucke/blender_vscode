import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';


const readdir = util.promisify(fs.readdir)
const stat = util.promisify(fs.stat)


async function getDirectories(path_: string): Promise<string[]> {
    let filesAndDirectories = await readdir(path_);

    let directories: string[] = [];
    await Promise.all(
        filesAndDirectories.map(async name => {
            const stats = await stat(path.join(path_, name));
            if (stats.isDirectory()) directories.push(name);
        })
    );
    return directories;
}

// todo read from registry Blender installation path
const typicalWindowsBlenderFoundationPaths: string[] = [
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Blender Foundation"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Blender Foundation"),
]


export async function getBlenderWindows(): Promise<string[]> {
    let blenders: string[] = [];
    let dirs_to_check: string[] = []
    for (const typicalPath of typicalWindowsBlenderFoundationPaths) {
        const dirs: string[] = await getDirectories(typicalPath).catch((err: NodeJS.ErrnoException) => []);
        dirs_to_check.push(...dirs.map((dir: string) => path.join(typicalPath, dir)))
    }

    const exe = "blender.exe";
    for (const p of dirs_to_check) {
        const executable = path.join(p, exe)
        const stats = await stat(executable).catch((err: NodeJS.ErrnoException) => undefined);
        if (stats === undefined) continue;
        if (stats.isFile()) {
            blenders.push(executable)
        }
    }
    return blenders;
}