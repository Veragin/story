import { makeAutoObservable } from 'mobx';
import { TCharacterId, TEventId } from 'types/TIds';
import { TPassageScreen } from 'types/TPassage';

export class Store {
    passage: TPassageScreen<TEventId, TCharacterId> | null = null;

    constructor() {
        makeAutoObservable(this);
    }

    setPassage = (passage: TPassageScreen<TEventId, TCharacterId> | null) => {
        this.passage = passage;
    };
}
