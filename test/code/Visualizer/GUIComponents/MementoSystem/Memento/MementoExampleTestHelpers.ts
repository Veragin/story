// =============================================================================
// FILE: MementoExampleTestHelpers.ts
// =============================================================================

import { WithMemento } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/mementoTypes';

// Test domain objects - same as examples but for testing
export class TestUser implements WithMemento {
    constructor(
        public id: string,
        public name: string,
        public email: string,
        public isActive: boolean = true,
        public createdAt: Date = new Date()
    ) {}

    getId(): string {
        return `user-${this.id}`;
    }

    getObjectTypeName(): string {
        return this.constructor.name;
    }
}

export class TestTask implements WithMemento {
    constructor(
        public id: string,
        public title: string,
        public description: string,
        public isCompleted: boolean = false,
        public priority: number = 1,
        public assignedUser?: TestUser,
        public dueDate?: Date
    ) {}

    getId(): string {
        return `task-${this.id}`;
    }

    getObjectTypeName(): string {
        return this.constructor.name;
    }
}

export class TestProject implements WithMemento {
    public tasks: TestTask[] = [];

    constructor(
        public id: string,
        public name: string,
        public description: string,
        public owner: TestUser,
        public tags: string[] = [],
        public isArchived: boolean = false
    ) {}

    getId(): string {
        return `project-${this.id}`;
    }

    getObjectTypeName(): string {
        return this.constructor.name;
    }

    addTask(task: TestTask): void {
        this.tasks.push(task);
    }
}

export function createTestData() {
    const john = new TestUser('1', 'John Doe', 'john@example.com', true, new Date('2023-01-15'));
    const jane = new TestUser('2', 'Jane Smith', 'jane@example.com', true, new Date('2023-02-01'));
    
    const task1 = new TestTask('1', 'Design Database', 'Create the initial database schema', false, 3, john, new Date('2024-01-15'));
    const task2 = new TestTask('2', 'Write Tests', 'Unit tests for core functionality', true, 2, jane, new Date('2024-01-10'));
    const task3 = new TestTask('3', 'Deploy to Production', 'Final deployment step', false, 5);
    
    const project = new TestProject('1', 'Memento System', 'Implement memento pattern for state management', john, ['typescript', 'patterns', 'architecture']);
    project.addTask(task1);
    project.addTask(task2);
    project.addTask(task3);
    
    return { john, jane, task1, task2, task3, project };
}