import * as fs from 'fs';

import { BlenderExecutableData } from "./blender_executable";

export async function deduplicateSameHardLinks(
    blenderPathsToReduce: BlenderExecutableData[],
    removeMissingFiles = true,
    additionalBlenderPaths: BlenderExecutableData[] = []
): Promise<BlenderExecutableData[]> {
    let missingItem = -1;
    const additionalBlenderPathsInodes = new Set<number>();

    for (const item of additionalBlenderPaths) {
        if (item.linuxInode === undefined) {
            const stats = await fs.promises.stat(item.path).catch(() => undefined);
            if (stats === undefined) {
                continue;
            }
            item.linuxInode = stats.ino;
        }

        additionalBlenderPathsInodes.add(item.linuxInode);
    }

    const deduplicateHardLinks = new Map<number, BlenderExecutableData>();
    for (const item of blenderPathsToReduce) {
        if (item.linuxInode === undefined) {
            const stats = await fs.promises.stat(item.path).catch(() => undefined);
            if (stats === undefined) {
                if (removeMissingFiles) {
                    deduplicateHardLinks.set(missingItem, item);
                    missingItem -= 1;
                }
                continue;
            }
            item.linuxInode = stats.ino;
        }

        const inode = item.linuxInode;
        if (deduplicateHardLinks.has(inode)) {
            continue;
        }
        if (additionalBlenderPathsInodes.has(inode)) {
            continue;
        }

        deduplicateHardLinks.set(inode, item);
    }

    return Array.from(deduplicateHardLinks.values());
}
