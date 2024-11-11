import glob
import importlib.metadata
import os
import shutil
import sys
import subprocess
import textwrap
import bpy

from pathlib import Path
from typing import List, Optional, Tuple

from .environment import python_path
from semver import Version

_CWD_FOR_SUBPROCESSES = python_path.parent


def assert_packages_are_installed(package_names: List[str]):
    from . import handle_fatal_error

    for package in package_names:
        if not is_module_installed(package):
            handle_fatal_error(
                textwrap.dedent(
                    f"""\
            Package can not be imported: {package}
            If you are experiencing PermissionError please scroll up to the line `Execute:` and execute the command manually.
            Also close all Blender instances.
            For old system wide Blender installations you might to reinstall Blender."""
                )
            )


def ensure_packages_are_installed(package_names: List[str]):
    if not is_module_installed("pip"):
        install_pip()

    # Perform precise checks if any dependency changes are needed.
    # Manual checks prevent from unnecessary updates which on <0.21 installations may require admin rights
    # Moreover upgrading when using pip install --target is not possible.
    requires_reinstall = False
    for name in package_names:
        _name, requested_version = _split_package_version(name)
        if requested_version is None:
            continue
        requested_version = Version.parse(requested_version)
        real_version = package_version(name)
        if real_version is None:
            requires_reinstall = f"{name} is not installed"
            break
        real_version = Version.parse(real_version)
        assert isinstance(requested_version, Version), requested_version
        assert isinstance(real_version, Version), real_version
        if "==" in name and not (real_version == requested_version):
            requires_reinstall = f"{name}, got {real_version}"
            break
        elif "<=" in name and not (real_version <= requested_version):
            requires_reinstall = f"{name}, got {real_version}"
            break
        elif "<=" not in name and "<" in name and not (real_version < requested_version):
            requires_reinstall = f"{name}, got {real_version}"
            break
        elif ">=" not in name and ">" in name and not (real_version > requested_version):
            requires_reinstall = f"{name}, got {real_version}"
            break

    if requires_reinstall:
        print(f"INFO: dependencies require update because of {requires_reinstall}, reinstalling...")
        gracefully_remove_packages(bpy.utils.user_resource("SCRIPTS", path="modules"))
        install_packages(package_names)

    assert_packages_are_installed(package_names)


def gracefully_remove_packages(target_dir: str):
    """Carefully remove packages from target_dir that were installed with this extension.

    Known dependencies are produced by manually running dependency tree of dependencies:
    >>> pip install --target . --ignore-installed <dependencies>
    """
    print("INFO: Removing installed dependencies and metadata")
    known_dependencies = [
        "blinker",
        "certifi",
        "charset_normalizer",
        "click",
        "colorama",
        "debugpy",
        "flask",
        "idna",
        "itsdangerous",
        "jinja2",
        "markupsafe",
        "requests",
        "urllib3",
        "werkzeug",
    ]
    for package in known_dependencies:
        installed_package = os.path.join(target_dir, package)
        if os.path.exists(installed_package):
            print(f"DEBUG: remove {installed_package}")
            shutil.rmtree(installed_package)
        for metadata in glob.glob(os.path.join(target_dir, package + "-*.dist-info")):
            if os.path.exists(metadata):
                print(f"DEBUG: remove {metadata}")
                shutil.rmtree(metadata)


def install_packages(names: List[str]):
    target = get_package_install_directory()
    command = [str(python_path), "-m", "pip", "install", "--disable-pip-version-check", "--target", target, *names]

    print("INFO: execute:", " ".join(_escape_space(c) for c in command))
    subprocess.run(command, cwd=_CWD_FOR_SUBPROCESSES)


def _escape_space(name):
    return f'"{name}"' if " " in name else name


def install_pip():
    # try ensurepip before get-pip.py
    if is_module_installed("ensurepip"):
        command = [str(python_path), "-m", "ensurepip", "--upgrade"]
        print("INFO: execute:", " ".join(command))
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


def _split_package_version(name: str) -> Tuple[str, Optional[str]]:
    name_and_maybe_version = name.replace(">", "=").replace("<", "=").replace("==", "=").split("=")
    if len(name_and_maybe_version) == 0:
        return name, None
    elif len(name_and_maybe_version) == 1:
        return name_and_maybe_version[0], None
    else:
        return name_and_maybe_version[0], name_and_maybe_version[1]


def _strip_package_version(name: str) -> str:
    return _split_package_version(name)[0]


def package_version(package: str) -> Optional[str]:
    name = _strip_package_version(package)
    try:
        return importlib.metadata.version(_strip_package_version(name))
    except AttributeError:  # python <3.8
        import pkg_resources

        return pkg_resources.get_distribution(name).version
    except importlib.metadata.PackageNotFoundError:
        return None


is_module_installed = package_version
