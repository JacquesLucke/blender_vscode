from typing import Optional, Dict

EXTENSIONS_REPOSITORY: Optional[str] = None


def handle_setting_change(data: Dict):
    global EXTENSIONS_REPOSITORY
    name: str = data["name"]
    value = data["value"]

    if name == "addon.extensionsRepository":
        # can be updated only once to avoid weird corner cases
        if EXTENSIONS_REPOSITORY is None:
            EXTENSIONS_REPOSITORY = value
            print("Setting: EXTENSIONS_REPOSITORY to", EXTENSIONS_REPOSITORY)
    else:
        print("ERROR: unknown setting: ", name)
    return "OK"
