import os
import bpy
import sys
import subprocess
from bpy.props import *
from pathlib import Path

python_executable = Path(bpy.app.binary_path_python).resolve()

class InstallPythonPackageOperator(bpy.types.Operator):
    bl_idname = "development.install_python_package"
    bl_label = "Install Python Package"
    bl_description = "Check if a certain python package exists and try to install it if not"
    bl_options = {'INTERNAL'}

    package_name: StringProperty()

    def execute(self, context):
        if is_package_installed(self.package_name):
            self.report({'INFO'}, f"{self.package_name} is installed already")
            return {'FINISHED'}
        if not is_pip_installed():
            self.report({'ERROR'}, "Please install pip first")
            return {'CANCELLED'}

        try:
            install_package(self.package_name)
        except:
            self.report({'ERROR'}, f"Error while installing {self.package_name}, check the terminal")
            return {'CANCELLED'}

        self.report({'INFO'}, f"{self.package_name} package has been installed")
        return {'FINISHED'}

class InstallPipOperator(bpy.types.Operator):
    bl_idname = "development.install_pip"
    bl_label = "Install Pip"
    bl_description = "Try to install pip so that it can be used in Blender"
    bl_options = {'INTERNAL'}

    def execute(self, context):
        if is_package_installed("pip"):
            self.report({'INFO'}, "Pip is installed already")
            return {'FINISHED'}

        try:
            install_pip()
        except:
            self.report({'ERROR'}, "Error while installing pip, check the terminal")
            return {'CANCELLED'}

        self.report({'INFO'}, "pip has been installed")
        return {'FINISHED'}

def blender_uses_own_python():
    blender_directory = Path(bpy.app.binary_path).parent.resolve()
    return str(python_executable).startswith(str(blender_directory))

def install_pip():
    get_pip_path = Path(__file__).parent / "external" / "get-pip.py"
    subprocess.run(
        [str(python_executable), str(get_pip_path)],
        cwd=python_executable.parent,
        check=True)

def install_package(package_name):
    target = get_package_install_directory()
    subprocess.run(
        [str(python_executable), "-m", "pip", "install", package_name, "--target", target],
        cwd=python_executable.parent,
        check=True)

def get_package_install_directory():
    for path in sys.path:
        if os.path.basename(path) in ("dist-packages", "site-packages"):
            return path
    raise Exception("Cannot find package install directory")

def is_pip_installed():
    return is_package_installed("pip")

def is_package_installed(package_name):
    try:
        __import__(package_name)
        return True
    except ModuleNotFoundError:
        return False
