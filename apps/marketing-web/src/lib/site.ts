export const SITE_NAME = "叮咚上门";

// Canonical origin for SEO.
export const SITE_URL = "https://dingsm.com";

export const DOWNLOAD_URL = "https://dingsm.com/file/apk/mobile-user";

export const BRAND_COLOR_HSL = "33.094 94% 54%";

export function absoluteUrl(pathname: string) {
    if (!pathname.startsWith("/")) {
        pathname = `/${pathname}`;
    }
    return `${SITE_URL}${pathname}`;
}
