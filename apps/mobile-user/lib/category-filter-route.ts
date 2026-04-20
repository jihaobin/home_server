import type { ServiceTagDomain } from "@repo/types";

export const CATEGORY_FILTER_ROUTE_TYPE = {
    category: "category",
    tag: "tag",
} as const;

export type CategoryFilterRouteType =
    (typeof CATEGORY_FILTER_ROUTE_TYPE)[keyof typeof CATEGORY_FILTER_ROUTE_TYPE];

type RouteParamValue = string | number | null | undefined;

export type CategoryFilterRouteParams = {
    type?: RouteParamValue;
    categoryId?: RouteParamValue;
    categoryName?: RouteParamValue;
    defaultTabName?: RouteParamValue;
    defaultServiceId?: RouteParamValue;
    serviceTagId?: RouteParamValue;
    serviceTagName?: RouteParamValue;
    serviceTagDomain?: RouteParamValue;
};

export type NormalizedCategoryFilterRouteParams = {
    type: CategoryFilterRouteType;
    categoryId?: string;
    categoryName?: string;
    defaultTabName?: string;
    defaultServiceId?: string;
    serviceTagId?: string;
    serviceTagName?: string;
    serviceTagDomain?: ServiceTagDomain;
    title: string;
};

function normalizeRouteParamValue(value: RouteParamValue): string | undefined {
    if (value === null || value === undefined) {
        return undefined;
    }

    return String(value);
}

function normalizeServiceTagDomain(
    value: RouteParamValue,
): ServiceTagDomain | undefined {
    const normalizedValue = normalizeRouteParamValue(value);
    if (normalizedValue === "massage") {
        return normalizedValue;
    }

    return undefined;
}

export function normalizeCategoryFilterRouteParams(
    params: CategoryFilterRouteParams,
): NormalizedCategoryFilterRouteParams {
    const type =
        params.type === CATEGORY_FILTER_ROUTE_TYPE.tag
            ? CATEGORY_FILTER_ROUTE_TYPE.tag
            : CATEGORY_FILTER_ROUTE_TYPE.category;
    const categoryId = normalizeRouteParamValue(params.categoryId);
    const categoryName = normalizeRouteParamValue(params.categoryName);
    const explicitDefaultTabName = normalizeRouteParamValue(params.defaultTabName);
    const defaultServiceId = normalizeRouteParamValue(params.defaultServiceId);
    const defaultTabName = explicitDefaultTabName ?? categoryName;

    if (type === CATEGORY_FILTER_ROUTE_TYPE.tag) {
        const serviceTagName = normalizeRouteParamValue(params.serviceTagName);

        return {
            type,
            categoryId,
            categoryName,
            defaultTabName,
            defaultServiceId,
            serviceTagId: normalizeRouteParamValue(params.serviceTagId),
            serviceTagName,
            serviceTagDomain: normalizeServiceTagDomain(params.serviceTagDomain),
            title: serviceTagName ?? categoryName ?? "家庭保洁",
        };
    }

    return {
        type,
        categoryId,
        categoryName,
        defaultTabName,
        defaultServiceId,
        serviceTagId: undefined,
        serviceTagName: undefined,
        serviceTagDomain: undefined,
        title: categoryName ?? "家庭保洁",
    };
}
