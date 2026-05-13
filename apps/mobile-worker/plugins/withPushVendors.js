const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Buffer } = require('buffer');

const {
    withDangerousMod,
    withProjectBuildGradle,
    withAppBuildGradle,
    withSettingsGradle,
    withMainApplication,
    withAndroidManifest,
} = require('@expo/config-plugins');

const DEFAULTS = {
    timpushSource: './plugins/timpush-configs.json',
    timpushTarget: 'timpush-configs.json',
    agconnectSource: './plugins/agconnect-services.json',
    agconnectTarget: 'src/main/assets/agconnect-services.json',
    googleServicesSource: './plugins/google-services.json',
    googleServicesTarget: 'google-services.json',
    mcsSource: './plugins/mcs-services.json',
    mcsTarget: 'mcs-services.json',
    vendors: {
        huawei: true,
        honor: true,
        vivo: true,
        oppo: true,
        xiaomi: true,
        meizu: true,
        fcm: false,
    },
};

const CLASS_PATHS = [
    "classpath('com.google.gms:google-services:4.3.15')",
    "classpath('com.huawei.agconnect:agcp:1.9.1.301')",
    "classpath('com.hihonor.mcs:asplugin:2.0.1.300')",
];
const ANDROID_GRADLE_PLUGIN_VERSION = "classpath('com.android.tools.build:gradle:8.5.0')";

const PLUGIN_SNIPPETS = {
    fcm: "apply plugin: 'com.google.gms.google-services'",
    huawei: "apply plugin: 'com.huawei.agconnect'",
    honor: "apply plugin: 'com.hihonor.mcs.asplugin'",
};

const BUILDSCRIPT_REPOS = [
    '    maven { url "$rootDir/timpush-patched-maven" }',
    '    google()',
    '    mavenCentral()',
    '    maven { url "https://mirrors.tencent.com/nexus/repository/maven-public/" }',
    "    maven { url 'https://developer.huawei.com/repo/' }",
    "    maven { url 'https://developer.hihonor.com/repo' }",
];

const ALLPROJECTS_REPOS = [
    '    maven { url "$rootDir/timpush-patched-maven" }',
    '    google()',
    '    mavenCentral()',
    '    maven { url "https://mirrors.tencent.com/nexus/repository/maven-public/" }',
    "    maven { url 'https://developer.huawei.com/repo/' }",
    "    maven { url 'https://developer.hihonor.com/repo' }",
];

const MAVEN_REPOS = [
    '    gradlePluginPortal()',
    '    maven { url "$rootDir/timpush-patched-maven" }',
    '    google()',
    '    mavenCentral()',
    '    maven { url "https://mirrors.tencent.com/nexus/repository/maven-public/" }',
    "    maven { url 'https://developer.huawei.com/repo/' }",
    "    maven { url 'https://developer.hihonor.com/repo' }",
];

const DEPENDENCY_REPOS = [
    '  repositories {',
    '    maven { url "$rootDir/timpush-patched-maven" }',
    '    google()',
    '    mavenCentral()',
    '    maven { url "https://mirrors.tencent.com/nexus/repository/maven-public/" }',
    "    maven { url 'https://developer.huawei.com/repo/' }",
    "    maven { url 'https://developer.hihonor.com/repo' }",
    '  }',
].join('\n');

const PROGUARD_RULES = [
    '-keep class com.tencent.qcloud.** { *; }',
    '-keep class com.tencent.timpush.** { *; }',
];

const VENDOR_DEPENDENCIES = {
    huawei: "implementation 'com.tencent.timpush:huawei:8.9.7537'",
    xiaomi: "implementation 'com.tencent.timpush:xiaomi:8.9.7537'",
    oppo: "implementation 'com.tencent.timpush:oppo:8.9.7537'",
    vivo: "implementation 'com.tencent.timpush:vivo:8.9.7537'",
    honor: "implementation 'com.tencent.timpush:honor:8.9.7537'",
    meizu: "implementation 'com.tencent.timpush:meizu:8.9.7537'",
    fcm: "implementation 'com.tencent.timpush:fcm:8.9.7537'",
};

const PATCHED_VENDOR_AARS = [
    {
        artifactId: 'xiaomi-vendor',
        version: '6.0.1',
        originalPackageName: 'com.tencent.timpush',
        patchedPackageName: 'com.tencent.timpuxm',
    },
    {
        artifactId: 'oppo-vendor',
        version: '3.5.3',
        originalPackageName: 'com.tencent.timpush',
        patchedPackageName: 'com.tencent.timpuop',
    },
    {
        artifactId: 'vivo-vendor',
        version: '4.1.0.0',
        originalPackageName: 'com.tencent.timpush',
        patchedPackageName: 'com.tencent.timpuvi',
    },
];

module.exports = function withPushVendors(config, userOptions = {}) {
    const options = { ...DEFAULTS, ...userOptions };
    options.vendors = { ...DEFAULTS.vendors, ...(userOptions.vendors || {}) };
    const androidPackage =
        config.android?.package ?? config.expo?.android?.package ?? config.slug;
    let cachedManifestPlaceholders = null;
    let resolvedVendorConfig = null;

    const ensureVendorConfigInitialized = projectRoot => {
        if (!resolvedVendorConfig) {
            resolvedVendorConfig = resolveVendorConfig({
                vendors: options.vendors,
                projectRoot,
                googleServicesSource: options.googleServicesSource,
            });
        }
        return resolvedVendorConfig;
    };

    config = withProjectBuildGradle(config, config => {
        config.modResults.contents = ensureClassPaths(config.modResults.contents);
        config.modResults.contents = ensureAndroidGradlePluginVersion(config.modResults.contents);
        config.modResults.contents = ensureBuildscriptRepositories(config.modResults.contents);
        config.modResults.contents = ensureAllProjectsRepositories(config.modResults.contents);
        return config;
    });

    config = withSettingsGradle(config, config => {
        config.modResults.contents = ensurePluginRepositories(config.modResults.contents);
        config.modResults.contents = ensureDependencyManagement(config.modResults.contents);
        return config;
    });

    config = withAppBuildGradle(config, config => {
        if (config.modResults.language !== 'groovy') {
            throw new Error('仅支持在 Groovy 版本的 build.gradle 中配置推送插件。');
        }
        const vendorConfig = ensureVendorConfigInitialized(config.modRequest.projectRoot);
        const pluginDirectives = buildPluginDirectives(vendorConfig);
        config.modResults.contents = ensureApplyPlugins(config.modResults.contents, pluginDirectives);
        if (!cachedManifestPlaceholders) {
            cachedManifestPlaceholders = readManifestPlaceholders({
                projectRoot: config.modRequest.projectRoot,
                source: options.timpushSource,
                packageName: androidPackage,
            });
        }
        config.modResults.contents = ensureManifestPlaceholders(
            config.modResults.contents,
            cachedManifestPlaceholders
        );
        config.modResults.contents = ensureVendorDependencies(
            config.modResults.contents,
            vendorConfig
        );
        return config;
    });

    config = withMainApplication(config, config => {
        config.modResults.contents = ensureMainApplicationBase(
            config.modResults.contents,
            config.modResults.language
        );
        return config;
    });

    config = withAndroidManifest(config, config => {
        config.modResults = ensureManifestApplicationAttributes(config.modResults);
        return config;
    });

    return withDangerousMod(config, [
        'android',
        config => {
            const { projectRoot, platformProjectRoot } = config.modRequest;
            const vendorConfig = ensureVendorConfigInitialized(projectRoot);

            copyFile({
                projectRoot,
                relativeSource: options.timpushSource,
                destination: path.join(
                    platformProjectRoot,
                    'app',
                    'src',
                    'main',
                    'assets',
                    options.timpushTarget
                ),
                missingMessage: '请先从控制台下载 timpush-configs.json 后再运行预构建。',
            });

            copyFile({
                projectRoot,
                relativeSource: options.agconnectSource,
                destination: path.join(platformProjectRoot, 'app', options.agconnectTarget),
                missingMessage: '请先从华为推送平台下载 agconnect-services.json 后再运行预构建。',
            });

            if (vendorConfig?.fcm) {
                copyFile({
                    projectRoot,
                    relativeSource: options.googleServicesSource,
                    destination: path.join(platformProjectRoot, 'app', options.googleServicesTarget),
                    missingMessage:
                        '缺少 google-services.json，若不需要 FCM 请在 withPushVendors 配置中关闭 vendors.fcm。',
                });
            }

            if (vendorConfig?.honor) {
                copyFile({
                    projectRoot,
                    relativeSource: options.mcsSource,
                    destination: path.join(platformProjectRoot, options.mcsTarget),
                    missingMessage: '缺少 mcs-services.json，若不需要荣耀推送可关闭 vendors.honor。',
                });
            }

            ensureProguardRules(
                path.join(platformProjectRoot, 'app', 'proguard-rules.pro'),
                PROGUARD_RULES
            );
            ensurePatchedVendorMavenRepository(platformProjectRoot);

            console.log(
                `已同步推送配置:\n- timpush -> ${path.join(
                    'android/app/src/main/assets',
                    options.timpushTarget
                )}\n- agconnect -> ${path.join('android/app', options.agconnectTarget)}${vendorConfig?.fcm
                    ? `\n- google-services -> ${path.join('android/app', options.googleServicesTarget)}`
                    : ''
                }${vendorConfig?.honor
                    ? `\n- mcs-services -> ${path.join('android', options.mcsTarget)}`
                    : ''
                }`
            );

            return config;
        },
    ]);
};

function ensureClassPaths(contents) {
    const pattern = /(buildscript\s*\{[\s\S]*?dependencies\s*\{)/;
    let output = contents;
    CLASS_PATHS.forEach(line => {
        if (!output.includes(line)) {
            if (!pattern.test(output)) {
                throw new Error('无法在 android/build.gradle 中找到 buildscript.dependencies 区块。');
            }
            output = output.replace(pattern, match => `${match}\n    ${line}`);
        }
    });
    return output;
}

function ensureAndroidGradlePluginVersion(contents) {
    if (contents.includes('com.android.tools.build:gradle:')) {
        return contents;
    }
    const regex = /classpath\(['"]com\.android\.tools\.build:gradle['"]\)/;
    if (regex.test(contents)) {
        return contents.replace(regex, ANDROID_GRADLE_PLUGIN_VERSION);
    }
    const pattern = /(buildscript\s*\{[\s\S]*?dependencies\s*\{)/;
    if (!pattern.test(contents)) {
        return contents;
    }
    return contents.replace(pattern, match => `${match}\n    ${ANDROID_GRADLE_PLUGIN_VERSION}`);
}

function ensureBuildscriptRepositories(contents) {
    const pattern = /(buildscript\s*\{[\s\S]*?repositories\s*\{)/;
    return insertLinesIfMissing(contents, pattern, BUILDSCRIPT_REPOS);
}

function ensureAllProjectsRepositories(contents) {
    const pattern = /(allprojects\s*\{[\s\S]*?repositories\s*\{)/;
    return insertLinesIfMissing(contents, pattern, ALLPROJECTS_REPOS);
}

function ensureApplyPlugins(contents, pluginDirectives) {
    let output = contents;
    if (!pluginDirectives || pluginDirectives.length === 0) {
        return output;
    }
    const applyBlockPattern = /(apply plugin: "com.facebook.react"\s*\n)/;
    const missing = pluginDirectives.filter(line => !output.includes(line));
    if (missing.length > 0) {
        if (applyBlockPattern.test(output)) {
            output = output.replace(applyBlockPattern, match => `${match}${missing.join('\n')}\n`);
        } else {
            output = `${missing.join('\n')}\n${output}`;
        }
    }
    return output;
}

function ensurePluginRepositories(contents) {
    if (contents.includes("https://developer.hihonor.com/repo")) {
        return contents;
    }
    const block = ['  repositories {', ...MAVEN_REPOS, '  }'].join('\n');
    if (/pluginManagement\s*\{/.test(contents)) {
        return contents.replace(/pluginManagement\s*\{/, match => `${match}\n${block}\n`);
    }
    return `pluginManagement {\n${block}\n}\n\n${contents}`;
}

function ensureDependencyManagement(contents) {
    if (contents.includes('dependencyResolutionManagement')) {
        return contents;
    }
    const snippet = `\ndependencyResolutionManagement {\n${DEPENDENCY_REPOS}\n}\n`;
    return `${contents.trimEnd()}\n${snippet}`;
}

function ensureManifestPlaceholders(contents, placeholders) {
    if (!placeholders || Object.keys(placeholders).length === 0) {
        return contents;
    }
    const existingMatch = contents.match(/manifestPlaceholders\s*=\s*\[([\s\S]*?)]/);
    const mergedPlaceholders = {
        ...(existingMatch ? parseManifestPlaceholders(existingMatch[1]) : {}),
        ...placeholders,
    };
    const block = formatManifestPlaceholders(mergedPlaceholders);
    if (/manifestPlaceholders\s*=/.test(contents)) {
        return contents.replace(/manifestPlaceholders\s*=\s*\[[^\]]*]/s, block);
    }
    const pattern = /(defaultConfig\s*\{)/;
    if (!pattern.test(contents)) {
        throw new Error('无法在 app/build.gradle 中找到 defaultConfig 区块。');
    }
    return contents.replace(pattern, match => `${match}\n${block}\n`);
}

function ensureVendorDependencies(contents, vendorConfig) {
    const pattern = /(dependencies\s*\{)/;
    if (!pattern.test(contents)) {
        return contents;
    }
    const selectedDeps = Object.entries(VENDOR_DEPENDENCIES)
        .filter(([key]) => vendorConfig?.[key])
        .map(([, dep]) => dep);
    const missing = selectedDeps.filter(line => !contents.includes(line));
    if (missing.length === 0) {
        return contents;
    }
    return contents.replace(pattern, match => `${match}\n    ${missing.join('\n    ')}\n`);
}

function copyFile({ projectRoot, relativeSource, destination, missingMessage }) {
    const sourcePath = path.resolve(projectRoot, relativeSource);
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`缺少 ${sourcePath}。${missingMessage}`);
    }

    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(sourcePath, destination);
}

function ensurePatchedVendorMavenRepository(platformProjectRoot) {
    PATCHED_VENDOR_AARS.forEach(vendor => {
        const sourceAar = findGradleCachedAar(vendor.artifactId, vendor.version);
        const targetDir = path.join(
            platformProjectRoot,
            'timpush-patched-maven',
            'com',
            'tencent',
            'timpush',
            vendor.artifactId,
            vendor.version
        );
        const targetAar = path.join(targetDir, `${vendor.artifactId}-${vendor.version}.aar`);
        const targetPom = path.join(targetDir, `${vendor.artifactId}-${vendor.version}.pom`);
        const targetModule = path.join(targetDir, `${vendor.artifactId}-${vendor.version}.module`);

        fs.mkdirSync(targetDir, { recursive: true });
        patchAarManifestPackage(sourceAar, targetAar, vendor);
        fs.writeFileSync(targetPom, buildVendorPom(vendor), 'utf8');
        fs.writeFileSync(targetModule, buildVendorModule(vendor), 'utf8');
    });
}

function findGradleCachedAar(artifactId, version) {
    const cacheRoots = [
        path.join(process.env.HOME || '', '.gradle', 'caches', 'modules-2', 'files-2.1'),
        path.resolve(process.cwd(), '..', '..', '..', '.gradle', 'caches', 'modules-2', 'files-2.1'),
        '/mnt/f/.gradle/caches/modules-2/files-2.1',
    ];
    const relativeDir = path.join('com.tencent.timpush', artifactId, version);
    const fileName = `${artifactId}-${version}.aar`;

    for (const cacheRoot of cacheRoots) {
        if (!cacheRoot || !fs.existsSync(cacheRoot)) {
            continue;
        }
        const moduleDir = path.join(cacheRoot, relativeDir);
        const found = findFile(moduleDir, fileName);
        if (found) {
            return found;
        }
    }

    throw new Error(
        `未找到 Gradle 缓存中的 ${relativeDir}/${fileName}。请先让 Gradle 下载一次 TPNS 依赖后再重新运行 prebuild。`
    );
}

function findFile(root, fileName) {
    if (!fs.existsSync(root)) {
        return null;
    }
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(root, entry.name);
        if (entry.isFile() && entry.name === fileName) {
            return fullPath;
        }
        if (entry.isDirectory()) {
            const found = findFile(fullPath, fileName);
            if (found) {
                return found;
            }
        }
    }
    return null;
}

function patchAarManifestPackage(sourceAar, targetAar, vendor) {
    const workDir = fs.mkdtempSync(path.join(path.dirname(targetAar), '.patch-'));
    try {
        const jarCommand = resolveJarCommand();
        execFileSync(jarCommand, ['xf', sourceAar], { cwd: workDir, stdio: 'ignore' });
        const manifestPath = path.join(workDir, 'AndroidManifest.xml');
        const manifest = fs.readFileSync(manifestPath);
        const original = Buffer.from(vendor.originalPackageName, 'utf8');
        const replacement = Buffer.from(vendor.patchedPackageName, 'utf8');
        if (original.length !== replacement.length) {
            throw new Error(`${vendor.artifactId} patched package name must match original length.`);
        }

        const patchedManifest = replaceAllBytes(manifest, original, replacement);
        if (patchedManifest.equals(manifest)) {
            throw new Error(`${sourceAar} 未找到 ${vendor.originalPackageName}，无法修补 manifest package。`);
        }
        fs.writeFileSync(manifestPath, patchedManifest);

        if (fs.existsSync(targetAar)) {
            fs.unlinkSync(targetAar);
        }
        execFileSync(jarCommand, ['cf', targetAar, '.'], { cwd: workDir, stdio: 'ignore' });
    } finally {
        fs.rmSync(workDir, { recursive: true, force: true });
    }
}

function resolveJarCommand() {
    if (process.env.JAVA_HOME) {
        const jarPath = path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'jar.exe' : 'jar');
        if (fs.existsSync(jarPath)) {
            return jarPath;
        }
    }
    return 'jar';
}

function replaceAllBytes(buffer, search, replacement) {
    const chunks = [];
    let offset = 0;
    let index = buffer.indexOf(search, offset);
    while (index !== -1) {
        chunks.push(buffer.subarray(offset, index), replacement);
        offset = index + search.length;
        index = buffer.indexOf(search, offset);
    }
    chunks.push(buffer.subarray(offset));
    return Buffer.concat(chunks);
}

function buildVendorPom(vendor) {
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<project xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd" xmlns="http://maven.apache.org/POM/4.0.0"',
        '    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
        '  <modelVersion>4.0.0</modelVersion>',
        '  <groupId>com.tencent.timpush</groupId>',
        `  <artifactId>${vendor.artifactId}</artifactId>`,
        `  <version>${vendor.version}</version>`,
        '  <packaging>aar</packaging>',
        '</project>',
        '',
    ].join('\n');
}

function buildVendorModule(vendor) {
    return JSON.stringify(
        {
            formatVersion: '1.1',
            component: {
                group: 'com.tencent.timpush',
                module: vendor.artifactId,
                version: vendor.version,
                attributes: {
                    'org.gradle.status': 'release',
                },
            },
            createdBy: {
                gradle: {
                    version: '8.13',
                },
            },
            variants: [
                {
                    name: 'releaseApiPublication',
                    attributes: {
                        'org.gradle.category': 'library',
                        'org.gradle.dependency.bundling': 'external',
                        'org.gradle.libraryelements': 'aar',
                        'org.gradle.usage': 'java-api',
                    },
                    files: [
                        {
                            name: `${vendor.artifactId}-${vendor.version}.aar`,
                            url: `${vendor.artifactId}-${vendor.version}.aar`,
                        },
                    ],
                },
                {
                    name: 'releaseRuntimePublication',
                    attributes: {
                        'org.gradle.category': 'library',
                        'org.gradle.dependency.bundling': 'external',
                        'org.gradle.libraryelements': 'aar',
                        'org.gradle.usage': 'java-runtime',
                    },
                    files: [
                        {
                            name: `${vendor.artifactId}-${vendor.version}.aar`,
                            url: `${vendor.artifactId}-${vendor.version}.aar`,
                        },
                    ],
                },
            ],
        },
        null,
        2
    );
}

function ensureProguardRules(filePath, rules) {
    let contents = '';
    if (fs.existsSync(filePath)) {
        contents = fs.readFileSync(filePath, 'utf8');
    }
    let updated = contents;
    rules.forEach(rule => {
        if (!updated.includes(rule)) {
            updated = `${updated.trimEnd()}\n${rule}\n`;
        }
    });

    if (updated !== contents) {
        fs.writeFileSync(filePath, updated);
    }
}

function insertLinesIfMissing(contents, blockPattern, lines) {
    const match = contents.match(blockPattern);
    if (!match) {
        return contents;
    }
    let block = match[0];
    let updated = block;
    lines.forEach(line => {
        const trimmed = line.trim();
        if (!block.includes(trimmed)) {
            updated += `\n${line}`;
        }
    });
    if (updated === block) {
        return contents;
    }
    return contents.replace(block, updated);
}

function resolveVendorConfig({ vendors, projectRoot, googleServicesSource }) {
    const resolved = { ...vendors };
    if (resolved.fcm) {
        const googlePath = path.resolve(projectRoot, googleServicesSource);
        if (!fs.existsSync(googlePath)) {
            console.warn(
                `[withPushVendors] 未找到 ${googlePath}，已跳过 FCM 配置。若需要 FCM，请将文件放在该路径下。`
            );
            resolved.fcm = false;
        }
    }
    return resolved;
}

function buildPluginDirectives(vendorConfig) {
    const directives = [];
    if (vendorConfig?.fcm) directives.push(PLUGIN_SNIPPETS.fcm);
    if (vendorConfig?.huawei) directives.push(PLUGIN_SNIPPETS.huawei);
    if (vendorConfig?.honor) directives.push(PLUGIN_SNIPPETS.honor);
    return directives;
}

function readManifestPlaceholders({ projectRoot, source, packageName }) {
    if (!projectRoot) {
        return null;
    }
    const filePath = path.resolve(projectRoot, source);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const key =
            (packageName && json[packageName] ? packageName : Object.keys(json).find(k => k !== 'version')) ||
            null;
        if (!key || !json[key] || typeof json[key].manifestPlaceholders !== 'object') {
            return null;
        }
        return json[key].manifestPlaceholders;
    } catch (error) {
        console.warn(`[withPushVendors] 无法解析 ${filePath}，原因：${error.message}`);
        return null;
    }
}

function formatManifestPlaceholders(placeholders) {
    const entries = Object.entries(placeholders).map(
        ([key, value]) => `            "${key}" : ${JSON.stringify(value ?? '')}`
    );
    return `        manifestPlaceholders = [\n${entries.join(',\n')}\n        ]`;
}

function parseManifestPlaceholders(block) {
    return block.split(/\r?\n/).reduce((result, line) => {
        const match = line.match(/["']([^"']+)["']\s*:\s*["']([^"']*)["']/);
        if (match) {
            result[match[1]] = match[2];
        }
        return result;
    }, {});
}

function ensureMainApplicationBase(contents, language) {
    if (language === 'kt') {
        return ensureMainApplicationKotlin(contents);
    }
    if (language === 'java') {
        return ensureMainApplicationJava(contents);
    }
    return contents;
}

function ensureMainApplicationKotlin(contents) {
    const importLine = 'import com.tencent.qcloud.rntimpush.TencentCloudPushApplication';
    let output = contents;
    if (!output.includes(importLine)) {
        output = output.replace(/(package[^\n]+\n)/, `$1\n${importLine}\n`);
    }
    const extendsPattern = /:\s*Application\(\)\s*,\s*ReactApplication/;
    if (extendsPattern.test(output)) {
        output = output.replace(
            extendsPattern,
            ': TencentCloudPushApplication(), ReactApplication'
        );
    }
    return output;
}

function ensureMainApplicationJava(contents) {
    const importLine = 'import com.tencent.qcloud.rntimpush.TencentCloudPushApplication;';
    let output = contents;
    if (!output.includes(importLine)) {
        output = output.replace(/(package[^\n]+;\s*)/, `$1\n${importLine}\n`);
    }
    if (/extends\s+Application/.test(output)) {
        output = output.replace(/extends\s+Application/, 'extends TencentCloudPushApplication');
    }
    return output;
}

function ensureManifestApplicationAttributes(androidManifest) {
    if (!androidManifest?.manifest) {
        return androidManifest;
    }
    const manifestRoot = androidManifest.manifest;
    manifestRoot.$ = manifestRoot.$ || {};
    if (!manifestRoot.$['xmlns:tools']) {
        manifestRoot.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }
    if (!manifestRoot.application || manifestRoot.application.length === 0) {
        return androidManifest;
    }
    const application = manifestRoot.application[0];
    application.$ = application.$ || {};
    const replaceList = new Set(
        (application.$['tools:replace'] || '')
            .split(',')
            .map(item => item.trim())
            .filter(Boolean)
    );
    replaceList.add('android:allowBackup');
    application.$['tools:replace'] = Array.from(replaceList).join(',');
    application.$['android:allowBackup'] = 'false';
    return androidManifest;
}
