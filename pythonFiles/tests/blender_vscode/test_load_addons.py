import contextlib
import os.path
import sys
from pathlib import Path
from typing import Dict
from unittest.mock import MagicMock, patch, Mock, PropertyMock

import pytest


@pytest.fixture(scope="function", autouse=True)
def bpy_global_defaults(request: pytest.FixtureRequest):
    # selection of modules provided with blender
    # when fake-bpy-module is installed: override it
    # when bpy is not available: provide Mock for further patching
    sys.modules["bpy"] = Mock()
    sys.modules["addon_utils"] = Mock()
    # DANGER: patching imports with global scope. Use returned patches to modify those values.
    # those defaults are required by global variables in blender_vscode.environment
    # todo those values are different for different blender versions
    patches = {
        "bpy.app": patch(
            "bpy.app",
            binary_path="/bin/usr/blender",
            # binary_path_python="/bin/usr/blender/Lib/bin/python",  # enable to emulate blender <2.92
            version=(4, 2, 0),
            spec_set=[
                "binary_path",
                "version",
                "timers",
                # "binary_path_python",  # enable to emulate blender <2.92
            ],
        ),
        "bpy.utils.user_resource": patch("bpy.utils.user_resource", side_effect=bpy_utils_user_resource),
        "addon_utils.paths": patch("addon_utils.paths", return_value=[]),
    }
    with contextlib.ExitStack() as stack:
        active_patches = {key: stack.enter_context(value) for key, value in patches.items()}
        yield active_patches

    # unload modules
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


def bpy_utils_user_resource(resource_type, path=None):
    if resource_type == "SCRIPTS":
        return os.path.sep.join(("", "4.2", "scripts", path))
    elif resource_type == "EXTENSIONS":
        return os.path.sep.join(("", "4.2", "extensions", path))
    else:
        raise ValueError("This resource is not supported in tests")


@patch("blender_vscode.load_addons.sys", path=[])
@patch("blender_vscode.load_addons.os.makedirs")
@patch("blender_vscode.load_addons.is_addon_legacy", return_value=True)
@patch("blender_vscode.load_addons.create_link_in_user_addon_directory")
@patch("blender_vscode.load_addons.bpy.context", **{"preferences.extensions.repos": []})
@patch("blender_vscode.load_addons.os.listdir", return_value=[])
class TestSetupAddonLinksDevelopAddon:
    @patch("blender_vscode.load_addons.is_in_any_addon_directory", return_value=False)
    @patch("blender_vscode.load_addons.is_in_any_extension_directory", return_value=False)
    def test_setup_addon_links_develop_addon_in_external_dir(
        self,
        is_in_any_extension_directory: MagicMock,
        is_in_any_addon_directory: MagicMock,
        listdir: MagicMock,
        bpy_context: MagicMock,
        create_link_in_user_addon_directory: MagicMock,
        is_addon_legacy: MagicMock,
        makedirs: MagicMock,
        sys_mock: MagicMock,
    ):
        """Example: user is developing addon in `/home/user/blenderProject`"""
        from blender_vscode import AddonInfo
        from blender_vscode.load_addons import setup_addon_links

        addons_to_load = [AddonInfo(load_dir=Path("/home/user/blenderProject/test-addon"), module_name="test_addon")]

        mappings = setup_addon_links(addons_to_load=addons_to_load)

        assert mappings == [
            {
                "src": os.path.sep.join("/home/user/blenderProject/test-addon".split("/")),
                "load": os.path.sep.join("/4.2/scripts/addons/test_addon".split("/")),
            }
        ]
        is_addon_legacy.assert_called_once()
        is_in_any_extension_directory.assert_not_called()
        create_link_in_user_addon_directory.assert_called_once_with(
            Path("/home/user/blenderProject/test-addon"),
            Path("/4.2/scripts/addons/test_addon"),
        )

    @patch("blender_vscode.load_addons.is_in_any_addon_directory", return_value=False)
    @patch("blender_vscode.load_addons.is_in_any_extension_directory", return_value=True)
    def test_setup_addon_links_develop_addon_in_extension_dir(
        self,
        is_in_any_extension_directory: MagicMock,
        is_in_any_addon_directory: MagicMock,
        listdir: MagicMock,
        bpy_context: MagicMock,
        create_link_in_user_addon_directory: MagicMock,
        is_addon_legacy: MagicMock,
        makedirs: MagicMock,
        sys_mock: MagicMock,
    ):
        """Example: user is developing addon in `/4.2/scripts/extensions/blender_org`"""
        from blender_vscode import AddonInfo
        from blender_vscode.load_addons import setup_addon_links

        addons_to_load = [
            AddonInfo(load_dir=Path("/4.2/scripts/extensions/blender_org/test-addon"), module_name="test_addon")
        ]

        mappings = setup_addon_links(addons_to_load=addons_to_load)

        assert mappings == [
            {
                "src": os.path.sep.join("/4.2/scripts/extensions/blender_org/test-addon".split("/")),
                "load": os.path.sep.join("/4.2/scripts/addons/test_addon".split("/")),
            }
        ]
        is_addon_legacy.assert_called_once()
        create_link_in_user_addon_directory.assert_called_once()
        is_in_any_extension_directory.assert_not_called()

    @patch("blender_vscode.load_addons.is_in_any_addon_directory", return_value=True)
    @patch("blender_vscode.load_addons.is_in_any_extension_directory", return_value=False)
    def test_setup_addon_links_develop_addon_in_addon_dir(
        self,
        is_in_any_extension_directory: MagicMock,
        is_in_any_addon_directory: MagicMock,
        listdir: MagicMock,
        bpy_context: MagicMock,
        create_link_in_user_addon_directory: MagicMock,
        is_addon_legacy: MagicMock,
        makedirs: MagicMock,
        sys_mock: MagicMock,
    ):
        """Example: user is developing addon in `/4.2/scripts/extensions/blender_org`"""
        from blender_vscode import AddonInfo
        from blender_vscode.load_addons import setup_addon_links

        addons_to_load = [AddonInfo(load_dir=Path("/4.2/scripts/addons/test_addon"), module_name="test_addon")]

        mappings = setup_addon_links(addons_to_load=addons_to_load)

        assert mappings == [
            {
                "src": os.path.sep.join("/4.2/scripts/addons/test_addon".split("/")),
                "load": os.path.sep.join("/4.2/scripts/addons/test_addon".split("/")),
            }
        ]
        is_in_any_addon_directory.assert_called_once()
        create_link_in_user_addon_directory.assert_not_called()
        is_in_any_extension_directory.assert_not_called()


@patch("blender_vscode.load_addons.sys", path=[])
@patch("blender_vscode.load_addons.os.makedirs")
@patch("blender_vscode.load_addons.is_addon_legacy", return_value=False)
@patch("blender_vscode.load_addons.create_link_in_user_addon_directory")
@patch("blender_vscode.load_addons.is_in_any_extension_directory", return_value=None)
@patch("blender_vscode.load_addons.addon_has_bl_info", return_value=False)
@patch("blender_vscode.load_addons.bpy.context", **{"preferences.extensions.repos": []})
@patch("blender_vscode.load_addons.os.listdir", return_value=[])
class TestSetupAddonLinksDevelopExtension:
    @patch("blender_vscode.load_addons.is_in_any_addon_directory", return_value=True)
    def test_setup_addon_links_develop_extension_in_addon_dir_is_treated_as_addon(
        self,
        is_in_any_addon_directory: MagicMock,
        listdir: MagicMock,
        bpy_context: MagicMock,
        addon_has_bl_info: MagicMock,
        is_in_any_extension_directory: MagicMock,
        create_link_in_user_addon_directory: MagicMock,
        is_addon_legacy: MagicMock,
        makedirs: MagicMock,
        sys_mock: MagicMock,
    ):
        """Example: user is developing extension  in `/4.2/scripts/addon/test-extension` **but** extension supports legacy addons"""
        addon_has_bl_info.return_value = True
        is_in_any_extension_directory.return_value = None

        from blender_vscode import AddonInfo
        from blender_vscode.load_addons import setup_addon_links

        addons_to_load = [AddonInfo(load_dir=Path("/4.2/scripts/addons/test-extension"), module_name="test_extension")]

        mappings = setup_addon_links(addons_to_load=addons_to_load)

        assert mappings == [
            {
                "src": os.path.sep.join("/4.2/scripts/addons/test-extension".split("/")),
                "load": os.path.sep.join("/4.2/scripts/addons/test-extension".split("/")),
            }
        ]
        create_link_in_user_addon_directory.assert_not_called()

    @patch("blender_vscode.load_addons.is_in_any_addon_directory", return_value=False)
    def test_setup_addon_links_develop_extension_in_extension_dir(
        self,
        is_in_any_addon_directory: MagicMock,
        listdir: MagicMock,
        bpy_context: MagicMock,
        addon_has_bl_info: MagicMock,
        is_in_any_extension_directory: MagicMock,
        create_link_in_user_addon_directory: MagicMock,
        is_addon_legacy: MagicMock,
        makedirs: MagicMock,
        sys_mock: MagicMock,
    ):
        """Example: user is developing extension in `/4.2/scripts/extensions/blender_org`"""
        repo_mock = Mock(
            enabled=True,
            use_custom_directory=False,
            custom_directory="",
            directory="/4.2/scripts/extensions/blender_org",
        )
        is_in_any_extension_directory.return_value = repo_mock

        from blender_vscode import AddonInfo
        from blender_vscode.load_addons import setup_addon_links

        addons_to_load = [
            AddonInfo(load_dir=Path("/4.2/scripts/extensions/blender_org/test-extension"), module_name="test_extension")
        ]

        mappings = setup_addon_links(addons_to_load=addons_to_load)

        assert mappings == [
            {
                "src": os.path.sep.join("/4.2/scripts/extensions/blender_org/test-extension".split("/")),
                "load": os.path.sep.join("/4.2/scripts/extensions/blender_org/test-extension".split("/")),
            }
        ]
        is_in_any_addon_directory.assert_not_called()
        create_link_in_user_addon_directory.assert_not_called()
        is_in_any_extension_directory.assert_called()

    @patch("blender_vscode.load_addons.is_in_any_addon_directory", return_value=True)
    def test_setup_addon_links_develop_extension_in_addon_dir(
        self,
        is_in_any_addon_directory: MagicMock,
        listdir: MagicMock,
        bpy_context: MagicMock,
        addon_has_bl_info: MagicMock,
        is_in_any_extension_directory: MagicMock,
        create_link_in_user_addon_directory: MagicMock,
        is_addon_legacy: MagicMock,
        makedirs: MagicMock,
        sys_mock: MagicMock,
    ):
        """Example: user is developing extension in `/4.2/scripts/addons/test-extension`"""
        is_in_any_extension_directory.return_value = None

        from blender_vscode import AddonInfo
        from blender_vscode.load_addons import setup_addon_links

        addons_to_load = [AddonInfo(load_dir=Path("/4.2/scripts/addons/test-extension"), module_name="test_extension")]

        mappings = setup_addon_links(addons_to_load=addons_to_load)

        assert mappings == [
            {
                "src": os.path.sep.join("/4.2/scripts/addons/test-extension".split("/")),
                "load": os.path.sep.join("/4.2/extensions/user_default/test_extension".split("/")),
            }
        ]
        is_in_any_addon_directory.assert_not_called()
        create_link_in_user_addon_directory.assert_called_once()
        is_in_any_extension_directory.assert_called()

    @patch("blender_vscode.load_addons.is_in_any_addon_directory", return_value=False)
    def test_setup_addon_links_develop_extension_in_external_dir(
        self,
        is_in_any_addon_directory: MagicMock,
        listdir: MagicMock,
        bpy_context: MagicMock,
        addon_has_bl_info: MagicMock,
        is_in_any_extension_directory: MagicMock,
        create_link_in_user_addon_directory: MagicMock,
        is_addon_legacy: MagicMock,
        makedirs: MagicMock,
        sys_mock: MagicMock,
    ):
        """Example: user is developing extension in `/home/user/blenderProjects/test-extension`"""
        from blender_vscode.load_addons import setup_addon_links
        from blender_vscode import AddonInfo

        addons_to_load = [
            AddonInfo(load_dir=Path("/home/user/blenderProject/test-extension"), module_name="test_extension")
        ]

        mappings = setup_addon_links(addons_to_load=addons_to_load)

        assert mappings == [
            {
                "src": os.path.sep.join("/home/user/blenderProject/test-extension".split("/")),
                "load": os.path.sep.join("/4.2/extensions/user_default/test_extension".split("/")),
            }
        ]
        create_link_in_user_addon_directory.assert_called_once()
        is_in_any_extension_directory.assert_called()


class TestIsInAnyAddonDirectory:
    def test_is_in_any_addon_directory(self, bpy_global_defaults: Dict):
        bpy_global_defaults["addon_utils.paths"].return_value = ["/4.2/scripts/addons"]

        import blender_vscode.load_addons as load_addons

        ret = load_addons.is_in_any_addon_directory(Path("/4.2/scripts/addons/my-addon1"))
        assert ret

        ret = load_addons.is_in_any_addon_directory(Path("scripts/my-addon2"))
        assert not ret


class TestIsInAnyExtensionDirectory:
    def test_is_in_any_extension_directory(self):
        repo_mock = Mock(
            enabled=True,
            use_custom_directory=False,
            custom_directory="",
            directory="/4.2/scripts/extensions/blender_org",
        )
        with patch("blender_vscode.load_addons.bpy", **{"context.preferences.extensions.repos": [repo_mock]}) as repos:
            from blender_vscode import load_addons

            ret = load_addons.is_in_any_extension_directory(Path("/4.2/scripts/addons/my-addon1"))
            assert ret is None

            ret = load_addons.is_in_any_extension_directory(Path("/4.2/scripts/extensions/blender_org/my-addon2"))
            assert ret is repo_mock


@patch("blender_vscode.load_addons.bpy.ops.preferences.addon_refresh")
@patch("blender_vscode.load_addons.bpy.ops.preferences.addon_enable")
@patch("blender_vscode.load_addons.bpy.ops.extensions.repo_refresh_all")
@patch("blender_vscode.load_addons.addon_has_bl_info", return_value=False)
@patch("blender_vscode.load_addons.is_in_any_addon_directory", return_value=False)
class TestLoad:
    @patch("blender_vscode.load_addons.is_addon_legacy", return_value=True)
    def test_load_legacy_addon_from_addons_dir(
        self,
        is_addon_legacy: MagicMock,
        addon_has_bl_info: MagicMock,
        is_in_any_addon_directory: MagicMock,
        repo_refresh_all: MagicMock,
        addon_enable: MagicMock,
        addon_refresh: MagicMock,
    ):
        from blender_vscode import AddonInfo

        addons_to_load = [AddonInfo(load_dir=Path("/4.2/scripts/addons/test-addon"), module_name="test-addon")]
        from blender_vscode.load_addons import load

        load(addons_to_load=addons_to_load)

        addon_enable.assert_called_once_with(module="test-addon")
        is_addon_legacy.assert_called_once()
        addon_refresh.assert_called_once()
        repo_refresh_all.assert_not_called()

    @patch("blender_vscode.load_addons.is_addon_legacy", return_value=False)
    def test_load_extension_from_extensions_dir(
        self,
        is_addon_legacy: MagicMock,
        addon_has_bl_info: MagicMock,
        is_in_any_addon_directory: MagicMock,
        repo_refresh_all: MagicMock,
        addon_enable: MagicMock,
        addon_refresh: MagicMock,
    ):
        repo_mock = Mock(
            enabled=True,
            use_custom_directory=False,
            custom_directory="",
            directory="/4.2/scripts/extensions/blender_org",
            module="blender_org",
        )

        with patch("blender_vscode.load_addons.bpy.context", **{"preferences.extensions.repos": [repo_mock]}):
            from blender_vscode import AddonInfo

            addons_to_load = [
                AddonInfo(load_dir=Path("/4.2/scripts/extensions/blender_org/test-addon2"), module_name="testaddon2"),
            ]

            from blender_vscode.load_addons import load

            load(addons_to_load=addons_to_load)

            addon_enable.assert_called_once_with(module="bl_ext.blender_org.testaddon2")
            is_addon_legacy.assert_called_once()
            repo_refresh_all.assert_called_once()
            addon_refresh.assert_not_called()

    @patch("blender_vscode.load_addons.is_addon_legacy", return_value=False)
    def test_load_extension_extension_in_addon_dir_is_treated_as_addon(
        self,
        is_addon_legacy: MagicMock,
        addon_has_bl_info: MagicMock,
        is_in_any_addon_directory: MagicMock,
        repo_refresh_all: MagicMock,
        addon_enable: MagicMock,
        addon_refresh: MagicMock,
    ):
        addon_has_bl_info.return_value = True
        is_in_any_addon_directory.return_value = True
        from blender_vscode import AddonInfo

        addons_to_load = [AddonInfo(load_dir=Path("/4.2/scripts/addons/test-addon"), module_name="test-addon")]
        from blender_vscode.load_addons import load

        load(addons_to_load=addons_to_load)

        addon_enable.assert_called_once_with(module="test-addon")
        is_addon_legacy.assert_called_once()
        addon_refresh.assert_called_once()
        repo_refresh_all.assert_not_called()
