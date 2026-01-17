const { withAndroidManifest } = require("@expo/config-plugins")

const TRUE_SET = new Set(["1", "true", "yes", "on"])
const FALSE_SET = new Set(["0", "false", "no", "off"])

function resolveBooleanInput(value, defaultValue = false) {
    if (value === null || value === undefined) {
        return defaultValue
    }
    if (typeof value === "boolean") {
        return value
    }
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase()
        if (!normalized) {
            return defaultValue
        }
        if (TRUE_SET.has(normalized)) {
            return true
        }
        if (FALSE_SET.has(normalized)) {
            return false
        }
    }
    return defaultValue
}

function ensureToolsNamespace(androidManifest) {
    const manifestAttributes = androidManifest.manifest?.$
    if (!manifestAttributes) {
        return
    }
    if (!manifestAttributes["xmlns:tools"]) {
        manifestAttributes["xmlns:tools"] = "http://schemas.android.com/tools"
    }
}

function addToolsReplace(applicationAttributes, replaceItem) {
    const raw = applicationAttributes["tools:replace"]
    if (!raw) {
        applicationAttributes["tools:replace"] = replaceItem
        return
    }

    const parts = String(raw)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)

    if (!parts.includes(replaceItem)) {
        parts.push(replaceItem)
        applicationAttributes["tools:replace"] = parts.join(",")
    }
}

function applyCleartextFlag(androidManifest, enabled) {
    ensureToolsNamespace(androidManifest)
    const application = androidManifest.manifest?.application?.[0]
    if (!application || !application.$) {
        throw new Error("未找到 <application> 节点，无法设置 android:usesCleartextTraffic")
    }
    application.$["android:usesCleartextTraffic"] = enabled ? "true" : "false"
    addToolsReplace(application.$, "android:usesCleartextTraffic")
    return androidManifest
}

module.exports = function withCleartextTraffic(config, options = {}) {
    return withAndroidManifest(config, (config) => {
        const allowInsecureHttp = resolveBooleanInput(
            options.allowInsecureHttp ?? options.enabled ?? options.value,
            false,
        )
        config.modResults = applyCleartextFlag(config.modResults, allowInsecureHttp)
        if (allowInsecureHttp) {
            console.warn(
                "[withCleartextTraffic] 已打开 android:usesCleartextTraffic，用于调试 HTTP 环境",
            )
        }
        return config
    })
}
