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
    hours: number;
    minutes: number;
};

export const parseTimeInput = (input: string): TTimeInput => {
    const timeRegex = /(?:(\d+)h)?\s*(?:(\d+)min)?/;
    const match = input.match(timeRegex);
    
    return {
        hours: match?.[1] ? parseInt(match[1]) : 0,
        minutes: match?.[2] ? parseInt(match[2]) : 0
    };
};

export const formatTimeInput = (time: TTimeInput): string => {
    if (time.hours === 0 && time.minutes === 0) return '';
    if (time.hours === 0) return `${time.minutes}min`;
    if (time.minutes === 0) return `${time.hours}h`;
    return `${time.hours}h ${time.minutes}min`;
};

export const timeInputToDeltaTime = (time: TTimeInput): DeltaTime | undefined => {
    if (time.hours === 0 && time.minutes === 0) return undefined;
    return DeltaTime.fromString(formatTimeInput(time) as any);
};