import sys
from pathlib import Path
from unittest.mock import MagicMock, patch, Mock

import pytest


@pytest.fixture(scope="function", autouse=True)
def bpy_global_defaults(request: pytest.FixtureRequest):
    sys.modules["bpy"] = Mock()
    sys.modules["addon_utils"] = Mock()
    patches = (
        patch("bpy.app.binary_path", return_value="/bin/usr/blender"),
        patch("bpy.app.version", (2, 9, 0)),
        patch("addon_utils.paths", return_value=[]),
    )
    [p.start() for p in patches]

    yield patches

    [p.stop() for p in patches]
    del sys.modules["bpy"]
    del sys.modules["addon_utils"]
    del sys.modules["blender_vscode"]


class TestSetupAddonLinks:
    @patch("blender_vscode.utils.is_addon_legacy", return_value=True)
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

    @patch("blender_vscode.utils.is_addon_legacy", return_value=False)
    @patch("blender_vscode.load_addons.is_in_any_addon_directory", return_value=False)
    @patch("blender_vscode.load_addons.is_in_any_extension_directory", return_value=True)
    @patch(
        "blender_vscode.load_addons.create_link_in_user_addon_directory",
        return_value=MagicMock(
            enabled=True, use_custom_directory=False, custom_directory="", directory="scripts/extensions/blender_org"
        )
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

        get_user_addon_directory.assert_called_once()
        create_link_in_user_addon_directory.assert_not_called()
        assert mappings == [
            {
                "src": "scripts\\extensions\\blender_org\\test-extension",
                "load": "scripts\\extensions\\blender_org\\test-extension",
            }
        ]


class TestIsInAnyAddonDirectory:
    def test_is_in_any_addon_directory(self):
        with patch("addon_utils.paths", return_value=["scripts\\addons"]) as repos:
            from blender_vscode import load_addons

            ret = load_addons.is_in_any_addon_directory(Path("scripts/addons/my-addon1"))
            assert ret
            ret = load_addons.is_in_any_addon_directory(Path("scripts/my-addon2"))
            assert not ret


class TestIsInAnyExtensionDirectory:
    def test_is_in_any_extension_directory(self):
        repo_mock = Mock(
            enabled=True, use_custom_directory=False, custom_directory="", directory="scripts/extensions/blender_org"
        )
        with patch("bpy.context", **{"preferences.extensions.repos": [repo_mock]}) as repos:
            from blender_vscode import load_addons

            ret = load_addons.is_in_any_extension_directory(Path("scripts/addons/my-addon1"))
            assert ret is None

            ret = load_addons.is_in_any_extension_directory(Path("scripts/extensions/blender_org/my-addon2"))
            assert ret is repo_mock


class TestLoad:
    @patch("bpy.ops.preferences.addon_refresh")
    @patch("bpy.ops.preferences.addon_enable")
    @patch("blender_vscode.utils.is_addon_legacy", return_value=True)
    def test_load_legacy_addon_from_blender_addons(
        self,
        is_addon_legacy: MagicMock,
        addon_enable: MagicMock,
        addon_refresh: MagicMock,
    ):
        from blender_vscode import AddonInfo

        addons_to_load = [AddonInfo(load_dir=Path("scripts/addons/test-addon"), module_name="test-addon")]
        from blender_vscode.load_addons import load

        load(addons_to_load=addons_to_load)

        addon_enable.assert_called_once_with(module="test-addon")
        is_addon_legacy.assert_called_once()

    @patch("bpy.ops.preferences.addon_refresh")
    @patch("bpy.ops.preferences.addon_enable")
    @patch("bpy.ops.extensions.repo_refresh_all")
    @patch("blender_vscode.utils.is_addon_legacy", return_value=False)
    def test_load_extension(
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

        with patch("bpy.context", **{"preferences.extensions.repos": [repo_mock]}) as repos:
            from blender_vscode import AddonInfo
            from blender_vscode.load_addons import load

            addons_to_load = [
                AddonInfo(load_dir=Path("scripts/extensions/blender_org/test-addon2"), module_name="testaddon2"),
            ]

            load(addons_to_load=addons_to_load)

        is_addon_legacy.assert_called_once()
        repo_refresh_all.assert_called_once()
        addon_enable.assert_called_once_with(module="bl_ext.blender_org.testaddon2")
