import os
import sys
import bpy
import json
from pprint import pprint


def respond_and_exit(json_data):
    json_str = json.dumps(json_data)
    indicator = '<=#=>'
    if indicator in json_str:
        print('error detected')
    output_str = indicator + json_str + indicator
    print(output_str)
    sys.stdout.flush()

args_str = os.environ['BLENDER_TASK_ARGS']
args = json.loads(args_str)
print(args)

def handle_PATHS():
    addons_dir = bpy.utils.user_resource('SCRIPTS', 'addons')
    respond_and_exit({
        'addons_directory' : addons_dir,
    })

if args == 'PATHS':
    handle_PATHS()
else:
    print('unknown argument')
    sys.exit(1)
