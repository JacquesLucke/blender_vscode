def startup(editor_address, addon_paths, allow_modify_external_python):
    from . import installation
    installation.ensure_packages_are_installed(
        ["ptvsd", "flask", "requests"],
        allow_modify_external_python)

    from . import communication
    communication.setup(editor_address)

    from . import load_addons
    load_addons.load(addon_paths)

    from . import ui
    from . import operators

    ui.register()
    operators.register()
