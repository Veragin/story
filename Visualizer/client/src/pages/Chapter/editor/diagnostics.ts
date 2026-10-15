import { isCode, type TDiagnosticDto, type TPassageDto } from '@story/visualizer-protocol';

export type TDiagnosticIndex = {
    byField: Map<string, TDiagnosticDto[]>;
    unmapped: TDiagnosticDto[];
};

export const mapDiagnostics = (diagnostics: TDiagnosticDto[], fields: ReadonlySet<string>): TDiagnosticIndex => {
    const byField = new Map<string, TDiagnosticDto[]>();
    const unmapped: TDiagnosticDto[] = [];
    for (const d of diagnostics) {
        const target = d.field ? closestField(d.field, fields) : null;
        if (target === null) unmapped.push(d);
        else byField.set(target, [...(byField.get(target) ?? []), d]);
    }
    return { byField, unmapped };
};

const closestField = (path: string, fields: ReadonlySet<string>): string | null => {
    const parts = path.split('.');
    for (let n = parts.length; n > 0; n--) {
        const candidate = parts.slice(0, n).join('.');
        if (fields.has(candidate)) return candidate;
    }
    return null;
};

// containers are included so a diagnostic about a whole item shows at that item
export const passageFieldPaths = (p: TPassageDto): Set<string> => {
    const fields = new Set<string>(['execute']);
    if (p.type === 'linear') {
        fields.add('description').add('nextPassageId');
    } else if (p.type === 'transition') {
        fields.add('nextPassageId');
    } else {
        fields.add('title').add('image').add('body');
        if (!isCode(p.body)) {
            p.body.forEach((item, i) => {
                const b = `body.${i}`;
                fields.add(b).add(`${b}.condition`).add(`${b}.redirect`).add(`${b}.text`).add(`${b}.links`);
                if (item.links === undefined || isCode(item.links)) return;
                item.links.forEach((link, j) => {
                    const l = `${b}.links.${j}`;
                    fields
                        .add(l)
                        .add(`${l}.text`)
                        .add(`${l}.passageId`)
                        .add(`${l}.autoPriortiy`)
                        .add(`${l}.cost`)
                        .add(`${l}.onFinish`);
                    if (link.cost !== undefined && !isCode(link.cost) && !('seconds' in link.cost)) {
                        fields.add(`${l}.cost.time`).add(`${l}.cost.items`).add(`${l}.cost.tools`);
                    }
                });
            });
        }
    }
    return fields;
};

export const formatDiagnostic = (d: TDiagnosticDto) =>
    `${d.file}:${d.line}:${d.column} ${d.code ? `TS${d.code}: ` : ''}${d.message}`;
