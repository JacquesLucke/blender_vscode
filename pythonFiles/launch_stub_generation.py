import os
import sys
from pathlib import Path

include_dir = Path(__file__).parent / "include"
sys.path.append(str(include_dir))

import blender_stub_generation

print("Start Generating Stubs...")

blender_stub_generation.generate(os.environ["STUB_TARGET_PATH"])

print("\n\nDone.")