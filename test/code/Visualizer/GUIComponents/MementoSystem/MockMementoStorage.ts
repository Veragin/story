import { MementoStorage } from '../../../../../src/code/Visualizer/GUIComponents/MementoSystem/MementoStorage';
import { MementoRecord } from '../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/mementoTypes';

export class MockMementoStorage implements MementoStorage {
    private storage = new Map<string, MementoRecord>();
    private shouldThrowOnLoad = false;
    private shouldThrowOnSave = false;
    private loadDelay = 0;
    private saveDelay = 0;

    async loadMementoIds(): Promise<string[]> {
        if (this.shouldThrowOnLoad) {
            throw new Error('Mock storage load error');
        }
        await this.delay(this.loadDelay);
        return Array.from(this.storage.keys());
    }

    async loadMemento(id: string): Promise<MementoRecord | undefined> {
        if (this.shouldThrowOnLoad) {
            throw new Error('Mock storage load error');
        }
        await this.delay(this.loadDelay);
        return this.storage.get(id);
    }

    async saveMemento(memento: MementoRecord): Promise<void> {
        if (this.shouldThrowOnSave) {
            throw new Error('Mock storage save error');
        }
        await this.delay(this.saveDelay);
        this.storage.set(memento.id, memento);
    }

    async remove(id: string): Promise<boolean> {
        return this.storage.delete(id);
    }

    async clear(): Promise<void> {
        this.storage.clear();
    }

    // Test helpers
    setThrowOnLoad(shouldThrow: boolean): void {
        this.shouldThrowOnLoad = shouldThrow;
    }

    setThrowOnSave(shouldThrow: boolean): void {
        this.shouldThrowOnSave = shouldThrow;
    }

    setLoadDelay(ms: number): void {
        this.loadDelay = ms;
    }

    setSaveDelay(ms: number): void {
        this.saveDelay = ms;
    }

    getStorageSize(): number {
        return this.storage.size;
    }

    hasMemento(id: string): boolean {
        return this.storage.has(id);
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
