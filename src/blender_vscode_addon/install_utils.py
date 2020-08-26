# This file should not depend on any other files of the addon,
# because it is loaded to install the addon itself.

import os
import shutil
import filecmp
from pathlib import Path

def sync_directories(src_dir: Path, dst_dir: Path, *, verbose=False, ignore_cb=None):
    '''
    Update the destination directory so that it contains the same files
    and directories as the source directory.
    '''
    assert src_dir.exists()
    assert src_dir.is_dir()

    if ignore_cb is None:
        ignore_cb = lambda path: True

    if dst_dir.exists():
        if not dst_dir.is_dir():
            os.remove(dst_dir)
            print(f"Removed {dst_dir}")

    if not dst_dir.exists():
        shutil.copytree(src_dir, dst_dir)
        if verbose: print(f"Copied {dst_dir}")
        return

    assert dst_dir.is_dir()

    src_names = set(os.listdir(src_dir))
    dst_names = set(os.listdir(dst_dir))

    for name in src_names:
        src_path: Path = src_dir / name
        dst_path: Path = dst_dir / name

        if ignore_cb(src_path) or ignore_cb(dst_path):
            continue

        if src_path.is_dir():
            if dst_path.is_dir():
                sync_directories(src_path, dst_path)
            elif dst_path.is_file():
                os.remove(dst_path)
                if verbose: print(f"Removed {dst_path}")
            else:
                raise Exception(f"unknown path type: {src_path}")
        elif src_path.is_file():
            if dst_path.is_dir():
                shutil.rmtree(dst_path)
                shutil.copyfile(src_path, dst_path)
                if verbose: print(f"Updated {dst_path}")
            elif dst_path.is_file():
                if not filecmp.cmp(src_path, dst_path):
                    os.remove(dst_path)
                    shutil.copyfile(src_path, dst_path)
                    if verbose: print(f"Updated {dst_path}")
            elif not dst_path.exists():
                shutil.copyfile(src_path, dst_path)
                if verbose: print(f"Added {dst_path}")
        else:
            raise Exception(f"unknown path type: {src_path}")

    for name in dst_names:
        if name in src_names:
            continue
        dst_path: Path = dst_dir / name
        if ignore_cb(dst_path):
            continue
        if dst_path.is_dir():
            shutil.rmtree(dst_path)
            print(f"Removed {dst_path}")
        elif dst_path.is_file():
            os.remove(dst_path)
            print(f"Removed {dst_path}")
        else:
            raise Exception(f"unknown path type: {src_path}")
