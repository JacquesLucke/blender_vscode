# Contributing

Please make sure that your PR works with Blender 2.80:
- that requires you to use python 3.7 and 
- compatible Blender API (do a version check)

# Structure

- Blender entrypoint is in `pythonFiles/launch.py`
- VS Code entrypoint is `src/extension.ts`. Refer to VS code docs, there is nothing non standard here.

# Python guideline

Use Black formatter with `black --line-length 120`

## Python tests

There is no clear guideline and commitment to tests.

Some tests are prototyped in `pythonFiles/tests/blender_vscode/test_load_addons.py`.
They should be run outside of Blender what makes them easy to execute, but prone to breaking: there is a lot of patching
for small number of test.

Run tests:

```powershell
pip install pytest
cd pythonFile
$env:PYTHONPATH="./include" # powershell
pytest -s .\tests 
```

# Typescript guideline

Nothing more than `tslint.json`.