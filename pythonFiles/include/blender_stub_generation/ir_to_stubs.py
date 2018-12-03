import os
import shutil
from typing import List
from pathlib import Path

from . ir import *

def generate_packages(packages: List[PackageIR], include_path: str):
    include_path = Path(include_path)
    for package in packages:
        generate_package(package, include_path)

def generate_package(package: PackageIR, include_path):
    path = include_path / package.name
    print("Writing Output:", path, end="")

    if path.exists():
        shutil.rmtree(path)
    os.makedirs(path)

    for subpackage in package.subpackages:
        generate_package(subpackage, path)

