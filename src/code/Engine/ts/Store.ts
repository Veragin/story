import { TWorldState } from 'data/TWorldState';
import { action, makeObservable, observable } from 'mobx';
import { TUnkownPassageScreen } from './const';

export class Store {
    passage: TUnkownPassageScreen | null = null;

    constructor(public s: TWorldState) {
        makeObservable(this, {
            passage: observable,
            setPassage: action,
        });
    }

    setPassage = (passage: TUnkownPassageScreen | null) => {
        this.passage = passage;
    };
}
