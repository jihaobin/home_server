import assert from "node:assert/strict";

import {
    buildCategoryFilterTabs,
    resolveCategoryFilterTabServiceTagId,
    resolveCategoryFilterTabKey,
} from "./category-filter-tabs";

const tagTabs = buildCategoryFilterTabs({
    type: "tag",
    services: [
        { id: "service-1", name: "中式推拿" },
        { id: "service-2", name: "肩颈按摩" },
    ],
    tagEntries: [
        { tagId: "tag-1", tagName: "肩颈舒缓" },
        { tagId: "tag-2", tagName: "全身调理" },
    ],
});

assert.deepStrictEqual(tagTabs, [
    { key: "recommend", label: "推荐" },
    { key: "tag-1", label: "肩颈舒缓" },
    { key: "tag-2", label: "全身调理" },
]);

assert.equal(
    resolveCategoryFilterTabKey({
        type: "tag",
        defaultServiceId: undefined,
        defaultTabName: undefined,
        serviceTagId: "tag-2",
        shouldDeferInitialTab: false,
    }),
    "tag-2",
);

assert.equal(
    resolveCategoryFilterTabServiceTagId({
        type: "tag",
        activeTabKey: "tag-1",
    }),
    "tag-1",
);

assert.equal(
    resolveCategoryFilterTabServiceTagId({
        type: "tag",
        activeTabKey: "recommend",
    }),
    undefined,
);

console.log("category-filter-tabs tests passed");
