import type { ServiceTagDomain } from "@repo/types";
import { MASSAGE_CATEGORY_ID } from "@repo/types";
import { CATEGORY_FILTER_ROUTE_TYPE } from "@/lib/category-filter-route";

export function createMassageTagFilterRouteParams(input: {
    tagId: string;
    tagName: string;
    tagDomain: ServiceTagDomain;
}) {
    return {
        type: CATEGORY_FILTER_ROUTE_TYPE.tag,
        categoryId: MASSAGE_CATEGORY_ID,
        categoryName: "上门按摩",
        serviceTagId: input.tagId,
        serviceTagName: input.tagName,
        serviceTagDomain: input.tagDomain,
    };
}
