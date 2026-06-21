import js from "@eslint/js";

const browserGlobals = {
  document: "readonly",
  window: "readonly",
  URL: "readonly",
  fetch: "readonly",
  Event: "readonly",
  Element: "readonly",
  HTMLElement: "readonly",
  HTMLInputElement: "readonly",
  Node: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
};

const nodeGlobals = {
  process: "readonly",
  Buffer: "readonly",
  URL: "readonly",
  console: "readonly",
};

export default [
  {
    ignores: ["node_modules/", "playwright-report/", "test-results/"],
  },
  js.configs.recommended,
  {
    files: ["assets/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: browserGlobals,
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name='innerHTML']",
          message: "Use DOM builders and textContent instead of innerHTML.",
        },
        {
          selector: "MemberExpression[property.name='outerHTML']",
          message: "Use DOM builders and textContent instead of outerHTML.",
        },
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message: "Use DOM builders and textContent instead of insertAdjacentHTML.",
        },
      ],
    },
  },
  {
    files: ["scripts/**/*.mjs", "playwright.config.mjs", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: nodeGlobals,
    },
  },
  {
    files: ["tests/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...nodeGlobals,
        ...browserGlobals,
      },
    },
  },
];
