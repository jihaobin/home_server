export function createServicePersonnelRouteParams(input: {
    id: string;
    serviceId?: string | null;
    pricingId?: string | null;
    serviceName?: string | null;
    personnelName?: string | null;
}) {
    const serviceName = input.serviceName?.trim() ?? "";
    const personnelName = input.personnelName?.trim() ?? "";
    const isMassageService = serviceName.includes("按摩");

    return {
        id: input.id,
        ...(input.serviceId ? { serviceId: input.serviceId } : {}),
        ...(input.pricingId ? { pricingId: input.pricingId } : {}),
        ...(serviceName ? { serviceName } : {}),
        ...(personnelName ? { personnelName } : {}),
        ...(isMassageService ? { mock: "massage" as const } : {}),
    };
}
