import {
    isCode,
    isDeltaTime,
    type TDeltaTimeDto,
    type TLinkCostDto,
    type TMaybeCode,
} from '@story/visualizer-protocol';
import { quoteString } from '../../../components/codeLiterals';

/** `DeltaTime.fromMin(10)` / `DeltaTime.fromS(90)` — the forms the server's writer emits too. */
export const deltaToCode = ({ seconds }: TDeltaTimeDto) =>
    seconds % 60 === 0 ? `DeltaTime.fromMin(${seconds / 60})` : `DeltaTime.fromS(${seconds})`;

const maybe = <T>(value: TMaybeCode<T>, literal: (v: T) => string) => (isCode(value) ? value.code : literal(value));

/** A literal `TLinkCost` as TS source, for switching the cost to code. */
export const costToCode = (cost: TLinkCostDto): string => {
    if (isDeltaTime(cost)) return deltaToCode(cost);
    const parts: string[] = [];
    if (cost.time !== undefined) parts.push(`time: ${maybe(cost.time, deltaToCode)}`);
    if (cost.items !== undefined) {
        parts.push(
            `items: ${maybe(cost.items, (items) => `[${items.map((i) => `{ id: ${quoteString(i.id)}, amount: ${i.amount} }`).join(', ')}]`)}`
        );
    }
    if (cost.tools !== undefined) {
        parts.push(`tools: ${maybe(cost.tools, (tools) => `[${tools.map(quoteString).join(', ')}]`)}`);
    }
    return parts.length === 0 ? '{}' : `{ ${parts.join(', ')} }`;
};

const DELTA_RE = /^DeltaTime\.from(Min|S|Hour)\(\s*(\d+(?:\.\d+)?)\s*\)$/;

/** `DeltaTime.fromMin(10)` → `{ seconds: 600 }`; anything else stays code. */
export const parseDelta = (code: string): TDeltaTimeDto | undefined => {
    const m = DELTA_RE.exec(code.trim());
    if (!m) return undefined;
    const factor = m[1] === 'Min' ? 60 : m[1] === 'Hour' ? 3600 : 1;
    return { seconds: Number(m[2]) * factor };
};
