import { DeltaTime } from 'time/Time';
import { TItemId } from 'types/TItem';
import { TEventId } from 'types/TIds';

export type TLinkCost = {
    time?: DeltaTime;
    items?: { id: TItemId; amount: number }[];
    tools?: TItemId[];
};

export type TBodyItemLink = {
    text: string;
    passageId: string;
    autoPriority?: number;
    cost?: TLinkCost;
    onFinish?: () => void;
};

export type TBodyItem = {
    condition?: boolean;
    redirect?: string;
    text?: string;
    links?: TBodyItemLink[];
};

export type TPassageFormData = {
    title: string;
    image: string;
    character: string;
    body: TBodyItem[];
};

export type TFormProps = {
    onPassageCreated?: (passageId: string) => void;
    onCancel?: () => void;
    agent: any; // Replace with proper Agent type
    eventId: TEventId;
};

export type TTimeInput = {
    days: number;
    hours: number;
    minutes: number;
};

export const parseTimeInput = (input: string): TTimeInput => {
    // Support formats like: 1d, 2h, 30min, 1d 2h, 2h 30min, 1d 2h 30min
    const timeRegex = /(?:(\d+)d)?\s*(?:(\d+)h)?\s*(?:(\d+)min)?/;
    const match = input.match(timeRegex);
    
    return {
        days: match?.[1] ? parseInt(match[1]) : 0,
        hours: match?.[2] ? parseInt(match[2]) : 0,
        minutes: match?.[3] ? parseInt(match[3]) : 0
    };
};

export const formatTimeInput = (time: TTimeInput): string => {
    if (time.days === 0 && time.hours === 0 && time.minutes === 0) return '';
    
    const parts: string[] = [];
    if (time.days > 0) parts.push(`${time.days}d`);
    if (time.hours > 0) parts.push(`${time.hours}h`);
    if (time.minutes > 0) parts.push(`${time.minutes}min`);
    
    return parts.join(' ');
};

export const timeInputToDeltaTime = (time: TTimeInput): DeltaTime | undefined => {
    if (time.days === 0 && time.hours === 0 && time.minutes === 0) return undefined;
    
    const totalMinutes = (time.days * 24 * 60) + (time.hours * 60) + time.minutes;
    return DeltaTime.fromMin(totalMinutes);
};