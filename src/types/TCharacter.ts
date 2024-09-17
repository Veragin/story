import { register } from 'data/register';

export type TCharacter<Ch extends TCharacterId> = {
    id: Ch;
    name: string;

    spawnLocation: string;
    startPassageId: TPassageId<Ch, TEventId>;
};

export type TCharacterId = keyof (typeof register)['characters'];
export type TEventId = keyof (typeof register)['events'];
export type TPassageId<
    Ch extends TCharacterId,
    E extends TEventId
> = keyof (typeof register)['events'][E]['passages'][Ch];
