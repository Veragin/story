const segmentsOf = (path: string) => path.split('/').filter((segment) => segment !== '' && segment !== '.');

export const dirName = (file: string) => file.slice(0, Math.max(file.lastIndexOf('/'), 0));

export const baseName = (file: string) => file.slice(file.lastIndexOf('/') + 1);

export const resolvePath = (fromDir: string, relative: string): string | undefined => {
    const resolved = segmentsOf(fromDir);
    for (const segment of segmentsOf(relative)) {
        if (segment !== '..') {
            resolved.push(segment);
        } else if (resolved.pop() === undefined) {
            return undefined;
        }
    }
    return resolved.join('/');
};

export const relativePath = (fromDir: string, to: string): string => {
    const from = segmentsOf(fromDir);
    const target = segmentsOf(to);
    let common = 0;
    while (common < from.length && common < target.length && from[common] === target[common]) common++;
    return [...from.slice(common).map(() => '..'), ...target.slice(common)].join('/');
};
