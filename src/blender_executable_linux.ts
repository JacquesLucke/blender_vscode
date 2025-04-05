import * as fs from 'fs';
import * as util from 'util';

import { BlenderExecutableData } from "./blender_executable";

const stat = util.promisify(fs.stat)

export async function deduplicateSameHardLinks(blenderPathsToReduce: BlenderExecutableData[], removeMissingFiles = true, additionalBlenderPaths: BlenderExecutableData[] = []) {
    let missingItem = -1;
    const additionalBlenderPathsInodes = new Set<number>();
    for (const item of additionalBlenderPaths) {
        if (item.linuxInode === undefined) {
            const stats = await stat(item.path).catch((err: NodeJS.ErrnoException) => undefined);
            if (stats === undefined) { continue; }
            item.linuxInode = stats.ino;
        }
        additionalBlenderPathsInodes.add(item.linuxInode);
    }

    const deduplicateHardLinks = new Map<number, BlenderExecutableData>();
    for (const item of blenderPathsToReduce) {
        if (item.linuxInode === undefined) {
            // try to find missing information
            const stats = await stat(item.path).catch((err: NodeJS.ErrnoException) => undefined);
            if (stats === undefined) {
                if (removeMissingFiles) {
                    deduplicateHardLinks.set(missingItem, item);
                    missingItem -= 1;
                }
                continue;
            }
            item.linuxInode = stats.ino;
        }
        if (deduplicateHardLinks.has(item.linuxInode)) continue;
        if (additionalBlenderPathsInodes.has(item.linuxInode)) continue;
        deduplicateHardLinks.set(item.linuxInode, item);
    }
    return Array.from(deduplicateHardLinks.values());
}
