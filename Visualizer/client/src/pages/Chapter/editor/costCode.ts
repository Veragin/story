import {
    isCode,
    isDeltaTime,
    isValueRecord,
    type TDeltaTimeDto,
    type TLinkCostDto,
    type TLinkCostObjectDto,
    type TMaybeCode,
    type TValue,
    type TValueRecord,
} from '@story/visualizer-protocol';
import { isString, parsePlainValue } from '../../../components/inputs/valueSource';

export type TCostItem = { id: string; amount: number };

export const DEFAULT_COST_TIME: TDeltaTimeDto = { seconds: 600 };

const COST_KEYS: readonly string[] = ['time', 'items', 'tools'];

const DELTA_RE = /^DeltaTime\.from(Min|S|Hour)\(\s*(\d+(?:\.\d+)?)\s*\)$/;

export const parseDelta = (code: string): TDeltaTimeDto | undefined => {
    const m = DELTA_RE.exec(code.trim());
    if (!m) return undefined;
    const factor = m[1] === 'Min' ? 60 : m[1] === 'Hour' ? 3600 : 1;
    return { seconds: Number(m[2]) * factor };
};

export const isCostItem = (value: TValue): value is TCostItem => {
    if (!isValueRecord(value)) return false;
    const record: TValueRecord = value;
    return Object.keys(record).length === 2 && typeof record.id === 'string' && typeof record.amount === 'number';
};

const timeOf = (value: TValue): TMaybeCode<TDeltaTimeDto> | undefined => {
    if (isCode(value)) return parseDelta(value.code) ?? value;
    return isDeltaTime(value) ? { seconds: value.seconds } : undefined;
};

const itemsOf = (value: TValue): TMaybeCode<TCostItem[]> | undefined => {
    if (isCode(value)) return value;
    return Array.isArray(value) && value.every(isCostItem) ? value.filter(isCostItem) : undefined;
};

const toolsOf = (value: TValue): TMaybeCode<string[]> | undefined => {
    if (isCode(value)) return value;
    return Array.isArray(value) && value.every(isString) ? value.filter(isString) : undefined;
};

const costObjectOf = (value: TValue): TLinkCostObjectDto | undefined => {
    if (!isValueRecord(value)) return undefined;
    const record: TValueRecord = value;
    if (Object.keys(record).some((key) => !COST_KEYS.includes(key))) return undefined;
    const cost: TLinkCostObjectDto = {};
    if ('time' in record) {
        const time = timeOf(record.time);
        if (time === undefined) return undefined;
        cost.time = time;
    }
    if ('items' in record) {
        const items = itemsOf(record.items);
        if (items === undefined) return undefined;
        cost.items = items;
    }
    if ('tools' in record) {
        const tools = toolsOf(record.tools);
        if (tools === undefined) return undefined;
        cost.tools = tools;
    }
    return cost;
};

export const parseCost = (code: string): TLinkCostDto | undefined => {
    const delta = parseDelta(code);
    if (delta) return delta;
    const value = parsePlainValue(code);
    return value === undefined ? undefined : costObjectOf(value);
};

export const formatDelta = (seconds: number): string => {
    const units: [number, string][] = [
        [86400, 'd'],
        [3600, 'h'],
        [60, 'min'],
        [1, 's'],
    ];
    let rest = Math.round(Math.abs(seconds));
    const parts: string[] = [];
    for (const [size, unit] of units) {
        const n = Math.floor(rest / size);
        rest -= n * size;
        if (n > 0) parts.push(`${n} ${unit}`);
    }
    return `${seconds < 0 ? '-' : ''}${parts.join(' ') || '0 min'}`;
};
