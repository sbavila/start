module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
  },
  extends: ["eslint:recommended", "prettier"],
  parserOptions: {
    sourceType: "module",
    ecmaVersion: "latest",
  },
  ignorePatterns: ["node_modules/"],
  rules: {
    "no-console": "off",
  },
  overrides: [
    {
      files: ["tests/**/*.js"],
      env: {
        node: true,
      },
    },
  ],
};
