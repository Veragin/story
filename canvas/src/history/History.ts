import { Observer } from '@story/shared';

/**
 * Undo/redo (VISUALIZER_PLAN §3.2 design rule 4: "Every mutation goes through history. Tools
 * emit commands; `history/` records them. Undo is not retro-fitted later.").
 *
 * ## Why this file is new rather than moved
 *
 * §1.1 describes `GUIComponents/MementoSystem/**` as "undo/redo … it survives this plan
 * unchanged, it just moves". It moved — it is the sibling of this file — but it is not undo/redo.
 * It is a *serialisation* system: a registry, a set of deep-snapshot processors, and a storage
 * port. It has no undo stack, no redo, its `loadMemento` is a `TODO` returning the raw record,
 * and it had zero importers anywhere in the repo. Nothing was going to become an undo button by
 * being moved into this package.
 *
 * So the snapshot machinery moved as planned and the command stack is here. They compose: a
 * command can capture a snapshot, and `SnapshotCommand` below is the bridge for the common case.
 *
 * ## Coalescing
 *
 * A drag is one undo step, not one per pointer-move. Commands opt into merging via
 * `coalesceWith`, and `History` only offers a merge to the command directly beneath — which,
 * combined with `transaction()` for the explicit case, covers both gestures and multi-object
 * edits without a tool having to think about the stack.
 */

export interface ICommand {
    /** Shown in the UI ("Move location", "Delete 3 objects"). Also what tests assert on. */
    readonly label: string;

    /** Applies the change. Called once when recorded, and again on every redo. */
    execute(): void;

    /** Reverses it. Must restore exactly the state `execute` was called on. */
    undo(): void;

    /**
     * Offered the command about to be pushed on top of this one. Return a single command that
     * does the work of both to merge, or `null`/`undefined` to keep them separate.
     *
     * This is what makes a 300-event drag one undo step. It is asked *before* `next` executes,
     * so a merged command must still describe the combined end state.
     */
    coalesceWith?(next: ICommand): ICommand | null | undefined;
}

export type THistoryChange = {
    reason: 'execute' | 'undo' | 'redo' | 'clear' | 'coalesce';
    command?: ICommand;
};

export type THistoryOptions = {
    /** Cap on the undo stack. The oldest entry is dropped when it is reached. */
    limit?: number;
};

export class History {
    private readonly undoStack: ICommand[] = [];
    private readonly redoStack: ICommand[] = [];
    private readonly limit: number;

    /**
     * Depth of the open `transaction()`. Commands recorded inside one are collected rather than
     * pushed, so the whole thing lands as a single entry.
     */
    private transactionDepth = 0;
    private transactionBuffer: ICommand[][] = [];

    /**
     * Set while `undo()`/`redo()` are running. A command's `execute`/`undo` will usually mutate
     * objects that a store is listening to, and a naive store might try to record *that* as a
     * new command — this is the flag it checks. Without it, undo pushes an undo of the undo.
     */
    private applying = false;

    readonly onChange = new Observer<THistoryChange>();

    constructor(options: THistoryOptions = {}) {
        this.limit = options.limit ?? 200;
    }

    get canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    get canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    /** True while an undo or redo is being applied — see `applying` above. */
    get isApplying(): boolean {
        return this.applying;
    }

    /** Labels of the entries that `undo()` would apply, most recent first. */
    get undoLabels(): string[] {
        return [...this.undoStack].reverse().map((command) => command.label);
    }

    get redoLabels(): string[] {
        return [...this.redoStack].reverse().map((command) => command.label);
    }

    /**
     * Runs a command and records it. The single entry point for every mutation.
     *
     * Recording a new command clears the redo stack, which is the standard linear-history
     * behaviour and the one every editor has trained people to expect.
     */
    execute(command: ICommand): void {
        if (this.applying) {
            // A command that records another command during undo would corrupt the stack.
            // Run it, but do not record it.
            command.execute();
            return;
        }

        command.execute();

        if (this.transactionDepth > 0) {
            this.transactionBuffer[this.transactionBuffer.length - 1].push(command);
            return;
        }

        this.record(command);
    }

    /** Records a command whose effect has already been applied — the end of a live drag. */
    record(command: ICommand): void {
        if (this.transactionDepth > 0) {
            this.transactionBuffer[this.transactionBuffer.length - 1].push(command);
            return;
        }

        this.redoStack.length = 0;

        const top = this.undoStack[this.undoStack.length - 1];
        const merged = top?.coalesceWith?.(command);
        if (merged) {
            this.undoStack[this.undoStack.length - 1] = merged;
            this.onChange.notify({ reason: 'coalesce', command: merged });
            return;
        }

        this.undoStack.push(command);
        if (this.undoStack.length > this.limit) this.undoStack.shift();
        this.onChange.notify({ reason: 'execute', command });
    }

    /**
     * Groups everything recorded inside `fn` into one entry. Nests: only the outermost call
     * produces a stack entry, so a tool can use a transaction without knowing whether its
     * caller already opened one.
     *
     * If `fn` throws, the commands recorded so far are rolled back before the error propagates —
     * a half-applied composite on the undo stack is worse than the original failure.
     */
    transaction<T>(label: string, fn: () => T): T {
        this.transactionDepth += 1;
        this.transactionBuffer.push([]);

        let result: T;
        try {
            result = fn();
        } catch (error) {
            const commands = this.transactionBuffer.pop() ?? [];
            this.transactionDepth -= 1;
            this.applying = true;
            try {
                for (let i = commands.length - 1; i >= 0; i--) commands[i].undo();
            } finally {
                this.applying = false;
            }
            throw error;
        }

        const commands = this.transactionBuffer.pop() ?? [];
        this.transactionDepth -= 1;

        if (commands.length === 0) return result;

        const command = commands.length === 1 ? commands[0] : new CompositeCommand(label, commands);
        if (this.transactionDepth > 0) {
            this.transactionBuffer[this.transactionBuffer.length - 1].push(command);
        } else {
            this.record(command);
        }
        return result;
    }

    undo(): boolean {
        const command = this.undoStack.pop();
        if (!command) return false;

        this.applying = true;
        try {
            command.undo();
        } finally {
            this.applying = false;
        }

        this.redoStack.push(command);
        this.onChange.notify({ reason: 'undo', command });
        return true;
    }

    redo(): boolean {
        const command = this.redoStack.pop();
        if (!command) return false;

        this.applying = true;
        try {
            command.execute();
        } finally {
            this.applying = false;
        }

        this.undoStack.push(command);
        this.onChange.notify({ reason: 'redo', command });
        return true;
    }

    clear(): void {
        this.undoStack.length = 0;
        this.redoStack.length = 0;
        this.onChange.notify({ reason: 'clear' });
    }
}

/** Several commands as one entry. Undone in reverse, which is the only order that composes. */
export class CompositeCommand implements ICommand {
    constructor(
        readonly label: string,
        private readonly commands: readonly ICommand[]
    ) {}

    execute(): void {
        for (const command of this.commands) command.execute();
    }

    undo(): void {
        for (let i = this.commands.length - 1; i >= 0; i--) this.commands[i].undo();
    }
}

/**
 * The general-purpose command: a pair of state snapshots and a function that applies one.
 *
 * `key` is what coalescing keys off. Two `SnapshotCommand`s with the same key merge into one
 * spanning the first's `before` and the second's `after` — which is exactly a drag: every
 * pointer-move records `("move:location-village", previousPoints, currentPoints)` and the stack
 * keeps one entry holding where the shape started and where it ended.
 */
export class SnapshotCommand<T> implements ICommand {
    constructor(
        readonly label: string,
        private readonly key: string,
        private readonly before: T,
        private readonly after: T,
        private readonly apply: (state: T) => void
    ) {}

    execute(): void {
        this.apply(this.after);
    }

    undo(): void {
        this.apply(this.before);
    }

    coalesceWith(next: ICommand): ICommand | null {
        if (!(next instanceof SnapshotCommand)) return null;
        if (next.key !== this.key) return null;
        return new SnapshotCommand<T>(next.label, this.key, this.before, next.after as T, this.apply);
    }
}

/** A command built from two closures. For the cases where a snapshot is the wrong shape. */
export class FunctionCommand implements ICommand {
    constructor(
        readonly label: string,
        private readonly doIt: () => void,
        private readonly undoIt: () => void
    ) {}

    execute(): void {
        this.doIt();
    }

    undo(): void {
        this.undoIt();
    }
}
