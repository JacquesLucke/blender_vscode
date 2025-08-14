import sys
import subprocess

import bpy

from pathlib import Path

from . import handle_fatal_error
from . import log
from .environment import python_path

LOG = log.getLogger()
_CWD_FOR_SUBPROCESSES = python_path.parent


def ensure_packages_are_installed(package_names):
    if packages_are_installed(package_names):
        return

    install_packages(package_names)


def packages_are_installed(package_names):
    return all(module_can_be_imported(name) for name in package_names)


def install_packages(package_names):
    if not module_can_be_imported("pip"):
        install_pip()

    for name in package_names:
        ensure_package_is_installed(name)

    assert packages_are_installed(package_names)


def ensure_package_is_installed(name: str):
    if not module_can_be_imported(name):
        install_package(name)


def install_package(name: str):
    target = get_package_install_directory()
    command = [str(python_path), "-m", "pip", "install", name, "--target", target]
    LOG.info(f"Execute: {' '.join(command)}")
    subprocess.run(command, cwd=_CWD_FOR_SUBPROCESSES)

    if not module_can_be_imported(name):
        handle_fatal_error(f"could not install {name}")


def install_pip():
    # try ensurepip before get-pip.py
    if module_can_be_imported("ensurepip"):
        command = [str(python_path), "-m", "ensurepip", "--upgrade"]
        LOG.info(f"Execute: {' '.join(command)}")
        subprocess.run(command, cwd=_CWD_FOR_SUBPROCESSES)
        return
    # pip can not necessarily be imported into Blender after this
    get_pip_path = Path(__file__).parent / "external" / "get-pip.py"
    subprocess.run([str(python_path), str(get_pip_path)], cwd=_CWD_FOR_SUBPROCESSES)


def get_package_install_directory() -> str:
    # user modules loaded are loaded by default by blender from this path
    # https://docs.blender.org/manual/en/4.2/editors/preferences/file_paths.html#script-directories
    modules_path = bpy.utils.user_resource("SCRIPTS", path="modules")
    if modules_path not in sys.path:
        # if the path does not exist blender will not load it, usually occurs in fresh install
        sys.path.append(modules_path)
    return modules_path


def module_can_be_imported(name: str):
    try:
        stripped_name = _strip_pip_version(name)
        mod = __import__(stripped_name)
        LOG.info("module: " + name + " is already installed")
        LOG.debug(stripped_name + ":" + getattr(mod ,"__version__", "None") + " in path: " + getattr(mod, "__file__", "None"))
        return True
    except ModuleNotFoundError:
        return False


def _strip_pip_version(name: str) -> str:
    name_strip_comparison_sign = name.replace(">", "=").replace("<", "=")
    return name_strip_comparison_sign.split("=")[0]
