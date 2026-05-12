const fs = require("fs");
const path = require("path");

const {
    withAppBuildGradle,
    withDangerousMod,
} = require("@expo/config-plugins");

const PROGUARD_RULES = [
    "-keep class cn.jpush.** { *; }",
    "-keep class cn.jiguang.** { *; }",
    "-dontwarn cn.jpush.**",
    "-dontwarn cn.jiguang.**",
    "-keep class com.cmic.sso.sdk.** { *; }",
    "-keep class com.sdk.** { *; }",
    "-keep class com.unicom.xiaowo.login.** { *; }",
    "-keep class com.mobile.auth.** { *; }",
];

module.exports = function withJVerification(config, options = {}) {
    const androidPackage =
        config.android?.package ?? config.expo?.android?.package ?? config.slug;
    const appKey = options.androidAppKey ?? options.appKey;
    const channel = options.channel ?? "default";

    if (!appKey) {
        throw new Error("withJVerification requires appKey/androidAppKey");
    }

    config = withAppBuildGradle(config, (config) => {
        if (config.modResults.language !== "groovy") {
            throw new Error(
                "withJVerification only supports Groovy build.gradle",
            );
        }
        config.modResults.contents = ensureManifestPlaceholders(
            config.modResults.contents,
            {
                JPUSH_PKGNAME: androidPackage,
                JPUSH_APPKEY: appKey,
                JPUSH_CHANNEL: channel,
            },
        );
        return config;
    });

    return withDangerousMod(config, [
        "android",
        (config) => {
            ensureProguardRules(
                path.join(
                    config.modRequest.platformProjectRoot,
                    "app",
                    "proguard-rules.pro",
                ),
                PROGUARD_RULES,
            );
            ensureLoginButtonDrawables(
                path.join(
                    config.modRequest.platformProjectRoot,
                    "app",
                    "src",
                    "main",
                    "res",
                    "drawable",
                ),
                config.modRequest.projectRoot,
                options,
            );
            return config;
        },
    ]);
};

function ensureManifestPlaceholders(contents, placeholders) {
    const entries = Object.entries(placeholders).map(
        ([key, value]) => `            "${key}" : "${value}"`,
    );

    const existingBlockPattern = /manifestPlaceholders\s*=\s*\[([\s\S]*?)\]/;
    const existingBlock = contents.match(existingBlockPattern);
    if (existingBlock) {
        const existingEntries = existingBlock[1]
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .filter(
                (line) =>
                    !Object.keys(placeholders).some((key) =>
                        line.includes(`"${key}"`),
                    ),
            )
            .map((line) => `            ${line.replace(/,$/, "")}`);
        const nextEntries = [...existingEntries, ...entries];

        return contents.replace(
            existingBlockPattern,
            `manifestPlaceholders = [\n${nextEntries.join(",\n")}\n        ]`,
        );
    }

    return contents.replace(
        /(defaultConfig\s*\{)/,
        `$1\n        manifestPlaceholders = [\n${entries.join(",\n")}\n        ]`,
    );
}

function ensureProguardRules(filePath, rules) {
    let contents = "";
    if (fs.existsSync(filePath)) {
        contents = fs.readFileSync(filePath, "utf8");
    }

    let updated = contents;
    rules.forEach((rule) => {
        if (!updated.includes(rule)) {
            updated = `${updated.trimEnd()}\n${rule}\n`;
        }
    });

    fs.writeFileSync(filePath, updated, "utf8");
}

function ensureLoginButtonDrawables(drawableDir, projectRoot, options) {
    fs.mkdirSync(drawableDir, { recursive: true });

    writeFileIfChanged(
        path.join(drawableDir, "jverification_login_btn_user.xml"),
        createLoginButtonSelector(
            "jverification_login_btn_user_normal",
            "jverification_login_btn_user_pressed",
        ),
    );
    writeFileIfChanged(
        path.join(drawableDir, "jverification_login_btn_user_normal.xml"),
        createRoundedRectDrawable("#F7951B"),
    );
    writeFileIfChanged(
        path.join(drawableDir, "jverification_login_btn_user_pressed.xml"),
        createRoundedRectDrawable("#E47F0C"),
    );

    writeFileIfChanged(
        path.join(drawableDir, "jverification_login_btn_worker.xml"),
        createLoginButtonSelector(
            "jverification_login_btn_worker_normal",
            "jverification_login_btn_worker_pressed",
        ),
    );
    writeFileIfChanged(
        path.join(drawableDir, "jverification_login_btn_worker_normal.xml"),
        createRoundedRectDrawable("#1D9BF0"),
    );
    writeFileIfChanged(
        path.join(drawableDir, "jverification_login_btn_worker_pressed.xml"),
        createRoundedRectDrawable("#167FD0"),
    );

    ensureSocialLoginButtonDrawables(drawableDir, projectRoot, options);
}

function createLoginButtonSelector(normalName, pressedName) {
    return `<?xml version="1.0" encoding="utf-8"?>
<selector xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:state_pressed="true" android:drawable="@drawable/${pressedName}" />
    <item android:drawable="@drawable/${normalName}" />
</selector>
`;
}

function createRoundedRectDrawable(color) {
    return `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <solid android:color="${color}" />
    <corners android:radius="14dp" />
</shape>
`;
}

function ensureSocialLoginButtonDrawables(drawableDir, projectRoot, options) {
    const icons = {
        wechat: options.wechatIcon ?? "assets/images/wechat-logo-svgrepo-com.png",
        qq: options.qqIcon ?? "assets/images/qq-logo.png",
    };

    for (const [name, relativeSource] of Object.entries(icons)) {
        const source = path.resolve(projectRoot, relativeSource);
        const iconName = `jverification_social_${name}_icon`;
        copyDrawablePng(
            source,
            path.join(drawableDir, `${iconName}.png`),
        );
        writeFileIfChanged(
            path.join(drawableDir, `jverification_social_${name}.xml`),
            createRoundedSocialButtonDrawable(iconName, "#FFFFFF", "#E5E7EB"),
        );
        writeFileIfChanged(
            path.join(drawableDir, `jverification_social_${name}_pressed.xml`),
            createRoundedSocialButtonDrawable(iconName, "#F3F4F6", "#D1D5DB"),
        );
        deleteIfExists(path.join(drawableDir, `jverification_social_${name}.png`));
        deleteIfExists(path.join(drawableDir, `jverification_social_${name}_pressed.png`));
    }

    deleteIfExists(path.join(drawableDir, "jverification_social_apple.xml"));
    deleteIfExists(path.join(drawableDir, "jverification_social_apple_pressed.xml"));
}

function createRoundedSocialButtonDrawable(iconName, backgroundColor, strokeColor) {
    return `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <shape android:shape="rectangle">
            <solid android:color="${backgroundColor}" />
            <stroke android:width="1dp" android:color="${strokeColor}" />
            <corners android:radius="14dp" />
        </shape>
    </item>
    <item
        android:left="10dp"
        android:top="10dp"
        android:right="10dp"
        android:bottom="10dp">
        <bitmap
            android:src="@drawable/${iconName}"
            android:gravity="fill" />
    </item>
</layer-list>
`;
}

function copyDrawablePng(source, destination) {
    if (!fs.existsSync(source)) {
        throw new Error(`JVerification social icon not found: ${source}`);
    }
    if (fs.existsSync(destination)) {
        const current = fs.readFileSync(destination);
        const next = fs.readFileSync(source);
        if (current.equals(next)) {
            return;
        }
    }
    fs.copyFileSync(source, destination);
}

function deleteIfExists(filePath) {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

function writeFileIfChanged(filePath, contents) {
    if (
        fs.existsSync(filePath) &&
        fs.readFileSync(filePath, "utf8") === contents
    ) {
        return;
    }
    fs.writeFileSync(filePath, contents, "utf8");
}
