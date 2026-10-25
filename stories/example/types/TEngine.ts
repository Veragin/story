import type { ReactNode } from 'react';
import type { DeltaTime, TPassageId } from '@story/shared';
import type { Engine } from '@story/core';
import type { TWorldState } from '@story/data';
import type { TCharacterId } from './ids';
import type { TItemId } from './TItem';
import type { TLink } from './TPassage';

export type TLinkClick = {
    link: TLink<TPassageId>;
    characterId: TCharacterId;
    time: DeltaTime;
    items: { id: TItemId; amount: number }[];
    tools: TItemId[];
};

export type TOnLinkClick = (click: TLinkClick, s: TWorldState, e: Engine) => void;

export type TTopbarProps = { s: TWorldState; e: Engine };

export type TEngineSettings = {
    onLinkClick?: TOnLinkClick;
    Topbar?: () => Promise<{ Topbar: (props: TTopbarProps) => ReactNode }>;
};
