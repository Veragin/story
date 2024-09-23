import { TWorldState } from 'data/TWorldState';
import { action, makeObservable, observable } from 'mobx';
import { TCharacterId, TEventId } from 'types/TIds';
import { TPassageScreen } from 'types/TPassage';

export class Store {
    passage: TPassageScreen<TEventId, TCharacterId> | null = null;

    constructor(public s: TWorldState) {
        makeObservable(this, {
            passage: observable,
            setPassage: action,
        });
    }

    setPassage = (passage: TPassageScreen<TEventId, TCharacterId> | null) => {
        this.passage = passage;
    };
}
