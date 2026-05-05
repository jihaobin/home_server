const { withAndroidManifest } = require("@expo/config-plugins")

const MAP_SCHEMES = ["qqmap", "baidumap", "iosamap", "androidamap"]

function getOrCreateQueries(manifest) {
    if (!manifest.manifest.queries) {
        manifest.manifest.queries = [{}]
    }
    return manifest.manifest.queries[0]
}

function ensureIntentQuery(queries, scheme) {
    if (!queries.intent) {
        queries.intent = []
    }

    const exists = queries.intent.some((intent) =>
        intent.data?.some((data) => data.$?.["android:scheme"] === scheme),
    )

    if (exists) {
        return
    }

    queries.intent.push({
        action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
        data: [{ $: { "android:scheme": scheme } }],
    })
}

module.exports = function withMapAppQueries(config) {
    return withAndroidManifest(config, (config) => {
        const queries = getOrCreateQueries(config.modResults)
        for (const scheme of MAP_SCHEMES) {
            ensureIntentQuery(queries, scheme)
        }
        return config
    })
}
