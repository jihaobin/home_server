const appJson = require("./app.json");

const WECHAT_PROGUARD_RULES = `-keep class com.tencent.mm.opensdk.** {
    *;
}

-keep class com.tencent.wxop.** {
    *;
}

-keep class com.tencent.mm.sdk.** {
    *;
}`;

function toArray(value) {
    if (!value) {
        return [];
    }

    return Array.isArray(value) ? value : [value];
}

function normalizeAssociatedDomain(universalLink) {
    if (!universalLink) {
        return null;
    }

    try {
        const url = new URL(universalLink);
        return `applinks:${url.host}`;
    } catch {
        return null;
    }
}

function mergeExpoBuildPropertiesPlugin(plugins) {
    let hasExpoBuildProperties = false;

    const mergedPlugins = plugins.map((plugin) => {
        if (!Array.isArray(plugin) || plugin[0] !== "expo-build-properties") {
            return plugin;
        }

        hasExpoBuildProperties = true;

        const options =
            plugin[1] && typeof plugin[1] === "object" ? plugin[1] : {};
        const android =
            options.android && typeof options.android === "object"
                ? options.android
                : {};
        const existingRules =
            typeof android.extraProguardRules === "string"
                ? android.extraProguardRules.trim()
                : "";
        const extraProguardRules = existingRules
            ? `${existingRules}\n${WECHAT_PROGUARD_RULES}`
            : WECHAT_PROGUARD_RULES;

        return [
            plugin[0],
            {
                ...options,
                android: {
                    ...android,
                    extraProguardRules,
                },
            },
        ];
    });

    if (hasExpoBuildProperties) {
        return mergedPlugins;
    }

    return [
        ...mergedPlugins,
        [
            "expo-build-properties",
            {
                android: {
                    extraProguardRules: WECHAT_PROGUARD_RULES,
                },
            },
        ],
    ];
}

module.exports = () => {
    const baseConfig = appJson.expo;
    const wechatAppId =
        process.env.EXPO_PUBLIC_WECHAT_USER_APP_ID?.trim() ||
        process.env.EXPO_PUBLIC_WECHAT_APP_ID?.trim();
    const wechatUniversalLink =
        process.env.EXPO_PUBLIC_WECHAT_USER_UNIVERSAL_LINK?.trim() ||
        process.env.EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK?.trim();

    const associatedDomain = normalizeAssociatedDomain(wechatUniversalLink);
    const scheme = Array.from(
        new Set([
            ...toArray(baseConfig.scheme),
            ...(wechatAppId ? [wechatAppId] : []),
        ]),
    );

    const associatedDomains = Array.from(
        new Set([
            ...toArray(baseConfig.ios?.associatedDomains),
            ...(associatedDomain ? [associatedDomain] : []),
        ]),
    );

    const plugins = mergeExpoBuildPropertiesPlugin([
        ...(baseConfig.plugins ?? []),
        "expo-wechat",
    ]);

    return {
        expo: {
            ...baseConfig,
            scheme,
            ios: {
                ...(baseConfig.ios ?? {}),
                associatedDomains,
            },
            plugins,
        },
    };
};
