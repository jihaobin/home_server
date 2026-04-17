import type { ServiceTagDomain } from "@repo/types";

export const MASSAGE_CATEGORY_ID = "wgla64hwo7zr9iz";

export function createMassageTagFilterRouteParams(input: {
    tagId: string;
    tagName: string;
    tagDomain: ServiceTagDomain;
}) {
    return {
        categoryId: MASSAGE_CATEGORY_ID,
        categoryName: "上门按摩",
        serviceTagId: input.tagId,
        serviceTagName: input.tagName,
        serviceTagDomain: input.tagDomain,
    };
}
