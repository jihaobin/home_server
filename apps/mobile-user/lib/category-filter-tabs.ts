import type { ServiceTagEntry } from "@repo/types";

import type { CategoryFilterRouteType } from "./category-filter-route";

type ServiceTabItem = {
    id: string;
    name: string;
};

type CategoryFilterTab = {
    key: string;
    label: string;
};

export function buildCategoryFilterTabs(input: {
    type: CategoryFilterRouteType;
    services: readonly ServiceTabItem[];
    tagEntries: readonly Pick<ServiceTagEntry, "tagId" | "tagName">[];
}): CategoryFilterTab[] {
    if (input.type === "tag") {
        return [
            { key: "recommend", label: "推荐" },
            ...input.tagEntries.map((tag) => ({
                key: tag.tagId,
                label: tag.tagName,
            })),
        ];
    }

    return [
        { key: "recommend", label: "推荐" },
        ...input.services.map((service) => ({
            key: service.id,
            label: service.name,
        })),
    ];
}

export function resolveCategoryFilterTabKey(input: {
    type: CategoryFilterRouteType;
    defaultServiceId?: string;
    defaultTabName?: string;
    serviceTagId?: string;
    shouldDeferInitialTab: boolean;
    recommendTabKey?: string;
    pendingTabKey?: string;
}) {
    const recommendTabKey = input.recommendTabKey ?? "recommend";
    const pendingTabKey = input.pendingTabKey ?? "__pending__";

    if (input.type === "tag" && input.serviceTagId) {
        return input.serviceTagId;
    }

    if (input.defaultServiceId) {
        return input.defaultServiceId;
    }

    return input.shouldDeferInitialTab ? pendingTabKey : recommendTabKey;
}

export function resolveCategoryFilterTabServiceTagId(input: {
    type: CategoryFilterRouteType;
    activeTabKey: string;
    recommendTabKey?: string;
}) {
    const recommendTabKey = input.recommendTabKey ?? "recommend";

    if (input.type !== "tag" || input.activeTabKey === recommendTabKey) {
        return undefined;
    }

    return input.activeTabKey;
}
