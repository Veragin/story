import type { TWorldState } from '@story/data';
import { action, makeObservable, observable } from 'mobx';
import { TPlayablePassage } from './const';

export class Store {
    passage: TPlayablePassage | null = null;

    constructor(public s: TWorldState) {
        makeObservable(this, {
            passage: observable,
            setPassage: action,
        });
    }

    setPassage = (passage: TPlayablePassage | null) => {
        this.passage = passage;
    };
}
