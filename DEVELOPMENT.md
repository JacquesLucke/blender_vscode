# Contributing

Please make sure that your PR works with Blender 2.80:
- That requires you to use python 3.7 and 
- Compatible Blender API (do a version check)
- Remember to update [CHANGELOG](./CHANGELOG.md): https://keepachangelog.com/en/1.0.0/
- Upcoming releases (roadmap) are planned in [milestones](https://github.com/JacquesLucke/blender_vscode/milestones)
- Generally don't commit commented out code unless there is a really good reason 
- Prefer comments to be full sentences

# Structure

- Blender entrypoint is in `pythonFiles/launch.py`
- VS Code entrypoint is `src/extension.ts`. Refer to VS code docs, there is nothing non standard here.

# Python guideline

Use Black formatter with `black --line-length 120`

## Python tests

There is no clear guideline or commitment to testing.

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

# Releasing

Releases are published manually via the `workflow_dispatch` trigger on two
workflows in `.github/workflows/`:

- `publish.yml` — stable release to the Visual Studio Marketplace and the
  [Open VSX Registry](https://open-vsx.org/).
- `publish-beta.yml` — pre-release (`preRelease: true`) to both registries.

## Required repository secrets

- `VS_MARKETPLACE_TOKEN` — personal access token for the Visual Studio
  Marketplace (already configured).
- `OPEN_VSX_TOKEN` — personal access token for the Open VSX Registry.
  To set it up:
  1. Log in to [open-vsx.org](https://open-vsx.org/) with the GitHub account
     that owns the `JacquesLucke` publisher namespace and claim the namespace
     if it is not claimed yet
     (see the [Open VSX publishing docs](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)).
  2. Generate a personal access token on open-vsx.org.
  3. Add it as the `OPEN_VSX_TOKEN` repository secret under
     Settings → Secrets and variables → Actions.

Until `OPEN_VSX_TOKEN` is configured, the Open VSX publish step is skipped
automatically and only the Marketplace release runs — existing releases are
unaffected.