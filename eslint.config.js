import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import prettierPlugin from "eslint-plugin-prettier";

export default [
  // 1) Don’t ever lint build/externals
  {
    ignores: ["dist", "node_modules", "testing", "docs", ".minimalify"],
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        tsconfigRootDir: process.cwd(),
        project: [
          "./tsconfig.json",
          "./tsconfig.base.json",
          "./tsconfig.eslint.json",
        ],
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: importPlugin,
      prettier: prettierPlugin,
    },
    settings: {
      // Let eslint-plugin-import use the TS parser
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"],
      },
      // And resolve via your tsconfig(s)
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true
        },
      },
    },
    rules: {
      //–– core + TS + import + prettier recommended rules ––
      ...tsPlugin.configs.recommended.rules,
      ...importPlugin.configs.recommended.rules,
      ...prettierPlugin.configs.recommended.rules,

      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "import/consistent-type-specifier-style": ["error", "prefer-inline"],
    },
  },
];
