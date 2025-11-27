const {
    defineConfig,
} = require("eslint/config");

const globals = require("globals");
const tsParser = require("@typescript-eslint/parser");
const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const stylistic = require('@stylistic/eslint-plugin');
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = defineConfig([{
    files: ["src/**/*.ts"],
    languageOptions: {
        globals: {
            ...globals.node,
        },

        parser: tsParser,
        "sourceType": "module",

        parserOptions: {
            "project": "tsconfig.json",
        },
    },

    extends: compat.extends("prettier"),

    plugins: {
        "@typescript-eslint": typescriptEslint,
        "@stylistic": stylistic,
    },

    "rules": {
        "@typescript-eslint/naming-convention": "warn",
        "@typescript-eslint/no-unused-expressions": "warn",
        "curly": ["warn", "multi-line"],
        "eqeqeq": ["warn", "always"],
        "no-redeclare": "warn",
        "no-throw-literal": "warn",
        "no-unused-expressions": "off",
        "stylistic/semi": ["off"],
        "stylistic/member-delimiter-style": ["warn", {
            "multiline": {
                "delimiter": "semi",
                "requireLast": true,
            },
            "singleline": {
                "delimiter": "semi",
                "requireLast": false,
            },
        }],
    },
}]);
