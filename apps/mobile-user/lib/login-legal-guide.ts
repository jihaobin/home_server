import { MMKV } from "react-native-mmkv";

const LOGIN_LEGAL_GUIDE_STORAGE = new MMKV({
    id: "mobile-user-login-legal-guide",
});

const LOGIN_LEGAL_GUIDE_SEEN_KEY = "login-legal-guide-seen";

export function hasSeenLoginLegalGuide() {
    return LOGIN_LEGAL_GUIDE_STORAGE.getBoolean(LOGIN_LEGAL_GUIDE_SEEN_KEY) === true;
}

export function markLoginLegalGuideSeen() {
    LOGIN_LEGAL_GUIDE_STORAGE.set(LOGIN_LEGAL_GUIDE_SEEN_KEY, true);
}
