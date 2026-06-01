// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole monorepo so changes in packages/engine are picked up.
config.watchFolders = [workspaceRoot];

// 2. Resolve modules from the app first, then the hoisted root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Use the package "exports" field so @astro/engine resolves to its TS source
//    (its exports."." points at ./src/index.ts; there is no built ./dist).
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
