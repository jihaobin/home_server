export function maskIdCardNumber(idCard?: string | null) {
    if (!idCard) {
        return idCard;
    }

    const normalized = idCard.trim();
    if (normalized.length <= 8) {
        if (normalized.length <= 2) {
            return `${normalized[0] ?? ''}${'*'.repeat(
                Math.max(normalized.length - 1, 0),
            )}`;
        }

        return `${normalized.slice(0, 1)}${'*'.repeat(
            normalized.length - 2,
        )}${normalized.slice(-1)}`;
    }

    const prefix = normalized.slice(0, 3);
    const suffix = normalized.slice(-4);
    return `${prefix}${'*'.repeat(normalized.length - 7)}${suffix}`;
}
