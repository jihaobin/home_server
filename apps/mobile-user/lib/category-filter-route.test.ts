import assert from "node:assert/strict";

import { createMassageTagFilterRouteParams } from "../components/massage/route";
import { normalizeCategoryFilterRouteParams } from "./category-filter-route";

const categoryMode = normalizeCategoryFilterRouteParams({
    categoryId: "category-1",
    categoryName: "家庭保洁",
    serviceTagId: "tag-should-be-ignored",
    serviceTagName: "不应生效",
});

assert.deepStrictEqual(categoryMode, {
    type: "category",
    categoryId: "category-1",
    categoryName: "家庭保洁",
    defaultTabName: "家庭保洁",
    defaultServiceId: undefined,
    serviceTagId: undefined,
    serviceTagName: undefined,
    serviceTagDomain: undefined,
    title: "家庭保洁",
});

const massageTagRouteParams = createMassageTagFilterRouteParams({
    tagId: "tag-1",
    tagName: "肩颈舒缓",
    tagDomain: "massage",
});

assert.equal(massageTagRouteParams.type, "tag");

const tagMode = normalizeCategoryFilterRouteParams(massageTagRouteParams);

assert.deepStrictEqual(tagMode, {
    type: "tag",
    categoryId: "wgla64hwo7zr9iz",
    categoryName: "上门按摩",
    defaultTabName: "上门按摩",
    defaultServiceId: undefined,
    serviceTagId: "tag-1",
    serviceTagName: "肩颈舒缓",
    serviceTagDomain: "massage",
    title: "肩颈舒缓",
});

console.log("category-filter-route tests passed");
