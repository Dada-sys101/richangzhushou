import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import vue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";

export function createEslintConfig() {
  return tseslint.config(
    {
      ignores: [
        "**/coverage/**",
        "**/dist/**",
        "**/generated/**",
        "**/node_modules/**",
      ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...vue.configs["flat/recommended"],
    {
      files: ["**/*.{js,mjs,ts,mts}"],
      languageOptions: {
        globals: globals.node,
      },
    },
    {
      files: ["apps/{admin,web}/**/*.{ts,vue}"],
      languageOptions: {
        globals: globals.browser,
      },
    },
    {
      files: ["**/*.vue"],
      languageOptions: {
        parserOptions: {
          extraFileExtensions: [".vue"],
          parser: tseslint.parser,
        },
      },
      rules: {
        "vue/multi-word-component-names": "off",
      },
    },
    prettier,
  );
}
