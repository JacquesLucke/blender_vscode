import os
import sys
import bpy
import subprocess

get_pip_path = os.environ['GET_PIP_PATH']
python_path = bpy.app.binary_path_python

subprocess.run([python_path, get_pip_path])

def installPackage(name):
    subprocess.run([python_path, "-m", "pip", "install", name])

installPackage("ptvsd")
installPackage("flask")

print("\n\nDone.")
input()