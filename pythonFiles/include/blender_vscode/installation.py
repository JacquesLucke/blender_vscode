import os
import sys
import bpy
import textwrap
import subprocess
from pathlib import Path
from . environment import python_path, use_own_python

def ensure_packages_are_installed(package_names, allow_modify_external_python):
    if packages_are_installed(package_names):
        return

    if not use_own_python and not allow_modify_external_python:
        raise cannot_install_exception(package_names)

    install_packages(package_names)

def packages_are_installed(package_names):
    return all(module_can_be_imported(name) for name in package_names)

def install_packages(package_names):
    if not module_can_be_imported("pip"):
        get_pip_path = Path(__file__).parent / "external" / "get-pip.py"
        subprocess.run([python_path, str(get_pip_path)])

    for name in package_names:
        ensure_package_is_installed(name)

    assert packages_are_installed(package_names)

def ensure_package_is_installed(name):
    if not module_can_be_imported(name):
        install_package(name)

def install_package(name):
    target = get_package_install_directory()
    subprocess.run([python_path, "-m", "pip", "install", name, '--target', target])

def get_package_install_directory():
    for path in sys.path:
        if os.path.basename(path) in ("dist-packages", "site-packages"):
            return path
    raise Exception("Don't know where to install packages.")

def module_can_be_imported(name):
    try:
        __import__(name)
        return True
    except ModuleNotFoundError:
        return False

def cannot_install_exception(package_names):
    return Exception(textwrap.dedent(f'''\
        Installing packages in Python distributions, that don't
        come with Blender, is not allowed currently.
        Please enable 'blender.allowModifyExternalPython' in VS Code
        or make sure that those packages are installed by yourself:
        {package_names}
    '''))
