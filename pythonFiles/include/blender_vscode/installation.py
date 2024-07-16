import os
import sys
import textwrap
import subprocess
from pathlib import Path
from . import handle_fatal_error
from .environment import python_path, use_own_python

cwd_for_subprocesses = python_path.parent


def ensure_packages_are_installed(package_names, allow_modify_external_python):
    if packages_are_installed(package_names):
        return

    if not use_own_python and not allow_modify_external_python:
        handle_cannot_install_packages(package_names)

    install_packages(package_names)


def packages_are_installed(package_names):
    return all(module_can_be_imported(name) for name in package_names)


def install_packages(package_names):
    if not module_can_be_imported("pip"):
        install_pip()

    for name in package_names:
        ensure_package_is_installed(name)

    assert packages_are_installed(package_names)


def ensure_package_is_installed(name):
    if not module_can_be_imported(name):
        install_package(name)


def install_package(name):
    target = get_package_install_directory()
    subprocess.run([str(python_path), "-m", "pip", "install", name, "--target", target], cwd=cwd_for_subprocesses)

    if not module_can_be_imported(name):
        handle_fatal_error(f"could not install {name}")


def install_pip():
    # try ensurepip before get-pip.py
    if module_can_be_imported("ensurepip"):
        subprocess.run([str(python_path), "-m", "ensurepip", "--upgrade"], cwd=cwd_for_subprocesses)
        return
    # pip can not necessarily be imported into Blender after this
    get_pip_path = Path(__file__).parent / "external" / "get-pip.py"
    subprocess.run([str(python_path), str(get_pip_path)], cwd=cwd_for_subprocesses)


def get_package_install_directory():
    for path in sys.path:
        if os.path.basename(path) in ("dist-packages", "site-packages"):
            return path

    handle_fatal_error("Don't know where to install packages. Please make a bug report.")


def module_can_be_imported(name):
    try:
        __import__(name)
        return True
    except ModuleNotFoundError:
        return False


def handle_cannot_install_packages(package_names):
    handle_fatal_error(
        textwrap.dedent(
            f"""\
        Installing packages in Python distributions, that
        don't come with Blender, is not allowed currently.
        Please enable 'blender.allowModifyExternalPython'
        in VS Code or install those packages yourself:

        {str(package_names):53}\
    """
        )
    )
