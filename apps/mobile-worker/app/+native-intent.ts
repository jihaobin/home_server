function toPathString(path: string) {
    if (!path) {
        return "/";
    }

    if (path.includes("://")) {
        try {
            const url = new URL(path);
            return `${url.pathname}${url.search}${url.hash}`;
        } catch {
            return "/";
        }
    }

    return path.startsWith("/") ? path : `/${path}`;
}

export function redirectSystemPath({ path }: { path: string }) {
    const normalizedPath = toPathString(path);

    if (normalizedPath.includes("/wxauth/")) {
        return "/profile/account-binding";
    }

    return normalizedPath;
}
