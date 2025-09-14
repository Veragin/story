import * as sinon from 'sinon';
import { WithMemento } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/mementoTypes';

export class MockMementoObject implements WithMemento {
    public getMementoIdSpy = sinon.stub();
    
    constructor(
        public id: string,
        public name: string = 'test',
        public value: number = 42,
        public isActive: boolean = true,
        public createdAt: Date = new Date('2023-01-01'),
        public description: string | null = null,
        public count: number | undefined = undefined
    ) {
        this.getMementoIdSpy.returns(id);
    }

    getMementoId(): string {
        return this.getMementoIdSpy();
    }
}

export class EmptyMementoObject implements WithMemento {
    constructor(public id: string) {}

    getMementoId(): string {
        return this.id;
    }
}

export class ComplexMementoObject implements WithMemento {
    constructor(
        public id: string,
        public stringProp: string,
        public numberProp: number,
        public booleanProp: boolean,
        public dateProp: Date,
        public nullProp: null,
        public undefinedProp: undefined,
        public nestedObject: { nested: string } // This should be skipped in current implementation
    ) {}

    getMementoId(): string {
        return this.id;
    }
}

// Additional test helpers for WithMemento object testing
export class MockMementoObjectWithReferences implements WithMemento {
    public getMementoIdSpy = sinon.stub();
    
    constructor(
        public id: string,
        public name: string = 'test',
        public relatedObject?: WithMemento,
        public relatedObjects?: WithMemento[],
        public mixedArray?: (string | number | boolean | null | WithMemento)[]
    ) {
        this.getMementoIdSpy.returns(id);
    }

    getMementoId(): string {
        return this.getMementoIdSpy();
    }
}

export class MockMementoParent implements WithMemento {
    public children: MockMementoChild[] = [];
    
    constructor(public id: string, public name: string = 'parent') {}

    getMementoId(): string {
        return this.id;
    }

    addChild(child: MockMementoChild): void {
        this.children.push(child);
        child.parent = this;
    }
}

export class MockMementoChild implements WithMemento {
    public parent?: MockMementoParent;
    
    constructor(public id: string, public name: string = 'child') {}

    getMementoId(): string {
        return this.id;
    }
}