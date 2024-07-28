import contextlib
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch, Mock
from typing import Dict

import pytest


@pytest.fixture(scope="function", autouse=True)
def bpy_global_defaults(request: pytest.FixtureRequest):
    sys.modules["bpy"] = Mock()
    sys.modules["addon_utils"] = Mock()
    # DANGER: patching imports with global scope. You can not override them in function.
    # https://docs.pytest.org/en/latest/example/parametrize.html#apply-indirect-on-particular-arguments
    patches = {
        "bpy.app.binary_path": patch("bpy.app.binary_path", "/bin/usr/blender"),
        "bpy.app.version": patch("bpy.app.version", (2, 9, 0)),
        "addon_utils.paths": patch("addon_utils.paths", return_value=[]),
    }
    with contextlib.ExitStack() as stack:
        active_patches = {key: stack.enter_context(value) for key, value in patches.items()}
        yield active_patches

    for module_name in [k for k in sys.modules.keys()]:
        if (
            module_name.startswith("blender_vscode")
            or module_name.startswith("bpy")
            or module_name.startswith("addon_utils")
        ):
            try:
                del sys.modules[module_name]
            except:
                pass


class TestSetupAddonLinks:
    @patch("blender_vscode.load_addons.is_addon_legacy", return_value=True, create=True)
    @patch("blender_vscode.load_addons.is_in_any_addon_directory", return_value=False)
    @patch("blender_vscode.load_addons.is_in_any_extension_directory", return_value=True)
    @patch("blender_vscode.load_addons.create_link_in_user_addon_directory", return_value=None)
    @patch("blender_vscode.load_addons.get_user_addon_directory", return_value=Path("scripts/addons"))
    def test_setup_addon_links_develop_addon_in_extension_dir(
        self,
        get_user_addon_directory: MagicMock,
        create_link_in_user_addon_directory: MagicMock,
        is_in_any_extension_directory: MagicMock,
        is_in_any_addon_directory: MagicMock,
        is_addon_legacy: MagicMock,
    ):
        """Example: user is developing addon in `scripts/extensions/blender_org`"""
        from blender_vscode import AddonInfo
        from blender_vscode.load_addons import setup_addon_links

        addons_to_load = [
            AddonInfo(load_dir=Path("scripts/extensions/blender_org/test-addon"), module_name="test_addon")
        ]

        mappings = setup_addon_links(addons_to_load=addons_to_load)

        assert mappings == [
            {
                "src": "scripts\\extensions\\blender_org\\test-addon",
                "load": "scripts\\extensions\\blender_org\\test-addon",
            }
        ]
        get_user_addon_directory.assert_called_once()
        create_link_in_user_addon_directory.assert_not_called()
        is_in_any_extension_directory.assert_called()

    @patch("blender_vscode.load_addons.is_addon_legacy", return_value=False)
    @patch("blender_vscode.load_addons.is_in_any_addon_directory", return_value=False)
    @patch("blender_vscode.load_addons.is_in_any_extension_directory", return_value=True)
    @patch(
        "blender_vscode.load_addons.create_link_in_user_addon_directory",
        return_value=MagicMock(
            enabled=True, use_custom_directory=False, custom_directory="", directory="scripts/extensions/blender_org"
        ),
    )
    @patch("blender_vscode.load_addons.get_user_addon_directory", return_value=Path("scripts/extensions/user_default"))
    def test_setup_addon_links_develop_extension_in_extension_dir(
        self,
        get_user_addon_directory: MagicMock,
        create_link_in_user_addon_directory: MagicMock,
        is_in_any_extension_directory: MagicMock,
        is_in_any_addon_directory: MagicMock,
        is_addon_legacy: MagicMock,
    ):
        """Example: user is developing extension in `scripts/extensions/blender_org`"""
        from blender_vscode import AddonInfo
        from blender_vscode.load_addons import setup_addon_links

        addons_to_load = [
            AddonInfo(load_dir=Path("scripts/extensions/blender_org/test-extension"), module_name="test_extension")
        ]

        mappings = setup_addon_links(addons_to_load=addons_to_load)

        assert mappings == [
            {
                "src": "scripts\\extensions\\blender_org\\test-extension",
                "load": "scripts\\extensions\\blender_org\\test-extension",
            }
        ]
        get_user_addon_directory.assert_called_once()
        create_link_in_user_addon_directory.assert_not_called()
        is_in_any_extension_directory.assert_called()


class TestIsInAnyAddonDirectory:
    def test_is_in_any_addon_directory(self, bpy_global_defaults: Dict):
        bpy_global_defaults["addon_utils.paths"].return_value = ["scripts\\addons"]
        import sys

        import blender_vscode.load_addons as load_addons

        ret = load_addons.is_in_any_addon_directory(Path("scripts/addons/my-addon1"))
        assert ret

        ret = load_addons.is_in_any_addon_directory(Path("scripts/my-addon2"))
        assert not ret


class TestIsInAnyExtensionDirectory:
    def test_is_in_any_extension_directory(self):
        repo_mock = Mock(
            enabled=True, use_custom_directory=False, custom_directory="", directory="scripts/extensions/blender_org"
        )
        with patch("blender_vscode.load_addons.bpy", **{"context.preferences.extensions.repos": [repo_mock]}) as repos:
            from blender_vscode import load_addons

            ret = load_addons.is_in_any_extension_directory(Path("scripts/addons/my-addon1"))
            assert ret is None

            ret = load_addons.is_in_any_extension_directory(Path("scripts/extensions/blender_org/my-addon2"))
            assert ret is repo_mock


class TestLoad:
    @patch("blender_vscode.load_addons.bpy.ops.preferences.addon_refresh")
    @patch("blender_vscode.load_addons.bpy.ops.preferences.addon_enable")
    @patch("blender_vscode.load_addons.bpy.ops.extensions.repo_refresh_all")
    @patch("blender_vscode.load_addons.is_addon_legacy", return_value=True)
    def test_load_legacy_addon_from_addons_dir(
        self,
        is_addon_legacy: MagicMock,
        repo_refresh_all: MagicMock,
        addon_enable: MagicMock,
        addon_refresh: MagicMock,
    ):
        from blender_vscode import AddonInfo

        addons_to_load = [AddonInfo(load_dir=Path("scripts/addons/test-addon"), module_name="test-addon")]
        from blender_vscode.load_addons import load

        load(addons_to_load=addons_to_load)

        addon_enable.assert_called_once_with(module="test-addon")
        is_addon_legacy.assert_called_once()
        addon_refresh.assert_called_once()
        repo_refresh_all.assert_not_called()

    @patch("blender_vscode.load_addons.bpy.ops.preferences.addon_refresh")
    @patch("blender_vscode.load_addons.bpy.ops.preferences.addon_enable", return_value=None)
    @patch("blender_vscode.load_addons.bpy.ops.extensions.repo_refresh_all", return_value="asd")
    @patch("blender_vscode.load_addons.is_addon_legacy", return_value=False)
    def test_load_extension_from_extensions_dir(
        self,
        is_addon_legacy: MagicMock,
        repo_refresh_all: MagicMock,
        addon_enable: MagicMock,
        addon_refresh: MagicMock,
    ):
        repo_mock = Mock(
            enabled=True,
            use_custom_directory=False,
            custom_directory="",
            directory="scripts/extensions/blender_org",
            module="blender_org",
        )

        with patch("blender_vscode.load_addons.bpy.context", **{"preferences.extensions.repos": [repo_mock]}):
            # with patch("blender_vscode.load_addons.bpy.ops.extensions.repo_refresh_all"):
            from blender_vscode import AddonInfo

            addons_to_load = [
                AddonInfo(load_dir=Path("scripts/extensions/blender_org/test-addon2"), module_name="testaddon2"),
            ]

            from blender_vscode.load_addons import load

            load(addons_to_load=addons_to_load)

            addon_enable.assert_called_once_with(module="bl_ext.blender_org.testaddon2")
            is_addon_legacy.assert_called_once()
            repo_refresh_all.assert_called_once()
            addon_refresh.assert_not_called()
