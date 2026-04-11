import { MMKV } from "react-native-mmkv";

const SEARCH_HISTORY_STORAGE = new MMKV({
    id: "mobile-user-search-history",
});

const SEARCH_HISTORY_KEY = "keyword-history";
const MAX_HISTORY_COUNT = 10;

export function normalizeSearchKeyword(keyword: string) {
    return keyword.trim().replace(/\s+/g, " ");
}

export function upsertSearchHistory(history: string[], keyword: string) {
    const normalizedKeyword = normalizeSearchKeyword(keyword);
    if (!normalizedKeyword) {
        return history;
    }

    const nextHistory = history.filter((item) => item !== normalizedKeyword);
    nextHistory.unshift(normalizedKeyword);
    return nextHistory.slice(0, MAX_HISTORY_COUNT);
}

export function getSearchHistory() {
    const rawValue = SEARCH_HISTORY_STORAGE.getString(SEARCH_HISTORY_KEY);
    if (!rawValue) {
        return [];
    }

    try {
        const parsedValue = JSON.parse(rawValue) as unknown;
        if (!Array.isArray(parsedValue)) {
            return [];
        }

        return parsedValue.filter(
            (item): item is string =>
                typeof item === "string" && Boolean(item.trim()),
        );
    } catch {
        SEARCH_HISTORY_STORAGE.delete(SEARCH_HISTORY_KEY);
        return [];
    }
}

export function saveSearchHistory(history: string[]) {
    SEARCH_HISTORY_STORAGE.set(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

export function recordSearchKeyword(keyword: string) {
    const nextHistory = upsertSearchHistory(getSearchHistory(), keyword);
    saveSearchHistory(nextHistory);
    return nextHistory;
}

export function removeSearchHistoryItem(keyword: string) {
    const normalizedKeyword = normalizeSearchKeyword(keyword);
    const nextHistory = getSearchHistory().filter(
        (item) => item !== normalizedKeyword,
    );
    saveSearchHistory(nextHistory);
    return nextHistory;
}

export function clearSearchHistory() {
    SEARCH_HISTORY_STORAGE.delete(SEARCH_HISTORY_KEY);
}
