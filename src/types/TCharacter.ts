import { register } from 'passages/register';
import { TEvent } from './TEvent';

export type TCharacter<Ch extends TCharacterId> = {
    id: Ch;
    name: string;

    events: Record<string, TEvent<Ch>>;
};

export type TCharacterId = keyof typeof register;
export type TEventId<Ch extends TCharacterId> = keyof (typeof register)[Ch]['events'];
export type TPassageId<
    Ch extends TCharacterId,
    E extends TEventId<Ch>
> = keyof (typeof register)[Ch]['events'][E]['passages'];
