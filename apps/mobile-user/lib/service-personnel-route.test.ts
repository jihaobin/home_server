import assert from "node:assert/strict";

import { createServicePersonnelRouteParams } from "./service-personnel-route";

assert.deepStrictEqual(
    createServicePersonnelRouteParams({
        id: "personnel-1",
        serviceId: "service-1",
        pricingId: "pricing-1",
        serviceName: "上门按摩",
        personnelName: "王师傅",
    }),
    {
        id: "personnel-1",
        serviceId: "service-1",
        pricingId: "pricing-1",
        serviceName: "上门按摩",
        personnelName: "王师傅",
        mock: "massage",
    },
);

assert.deepStrictEqual(
    createServicePersonnelRouteParams({
        id: "personnel-2",
        serviceId: "service-2",
        pricingId: "pricing-2",
        serviceName: "家庭保洁",
        personnelName: "李师傅",
    }),
    {
        id: "personnel-2",
        serviceId: "service-2",
        pricingId: "pricing-2",
        serviceName: "家庭保洁",
        personnelName: "李师傅",
    },
);

console.log("service-personnel-route tests passed");
