export const withDescription = <T extends { description?: string }>(
    value: T,
    description: string
): T => {
    const next = { ...value };
    delete next.description;
    return description === '' ? next : { ...next, description };
};
