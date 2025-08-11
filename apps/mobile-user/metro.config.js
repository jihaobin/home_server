// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const { FileStore } = require("@expo/metro-config/file-store");
const { withNativeWind } = require("nativewind/metro");

const path = require("node:path");

// 获取 monorepo 根目录
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = withTurborepoManagedCache(
    getDefaultConfig(__dirname, { isCSSEnabled: true })
);

// 配置 watchFolders 以包含 monorepo 根目录
config.watchFolders = [monorepoRoot];

// 配置模块解析路径
config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(monorepoRoot, 'node_modules'),
];

// 配置 disableHierarchicalLookup
config.resolver.disableHierarchicalLookup = false;

module.exports = withNativeWind(config, {
    input: "../../packages/mobile-ui/src/styles/global.css",
});

/**
 * Move the Metro cache to the `.cache/metro` folder.
 * If you have any environment variables, you can configure Turborepo to invalidate it when needed.
 *
 * @see https://turborepo.com/docs/reference/configuration#env
 * @param {import('expo/metro-config').MetroConfig} config
 * @returns {import('expo/metro-config').MetroConfig}
 */
function withTurborepoManagedCache(config) {
    config.cacheStores = [
        new FileStore({ root: path.join(__dirname, ".cache/metro") }),
    ];
    config.resolver.unstable_enablePackageExports = true;
    return config;
}
