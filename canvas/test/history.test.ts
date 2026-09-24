import { describe, expect, it, vi } from 'vitest';
import { CompositeCommand, FunctionCommand, History, SnapshotCommand } from '../src/history/History';

/** A command over one number, so a test can read the state it is asserting about. */
const setter = (state: { value: number }, from: number, to: number, key = 'value') =>
    new SnapshotCommand('set value', key, from, to, (next: number) => {
        state.value = next;
    });

describe('execute and undo', () => {
    it('applies on execute and reverses on undo', () => {
        const state = { value: 0 };
        const history = new History();

        history.execute(setter(state, 0, 42));
        expect(state.value).toBe(42);

        history.undo();
        expect(state.value).toBe(0);
    });

    it('re-applies on redo', () => {
        const state = { value: 0 };
        const history = new History();
        history.execute(setter(state, 0, 42));
        history.undo();
        history.redo();
        expect(state.value).toBe(42);
    });

    it('reports what it can do', () => {
        const state = { value: 0 };
        const history = new History();
        expect(history.canUndo).toBe(false);
        expect(history.canRedo).toBe(false);

        history.execute(setter(state, 0, 1));
        expect(history.canUndo).toBe(true);
        expect(history.canRedo).toBe(false);

        history.undo();
        expect(history.canUndo).toBe(false);
        expect(history.canRedo).toBe(true);
    });

    it('returns false rather than throwing on an empty stack', () => {
        const history = new History();
        expect(history.undo()).toBe(false);
        expect(history.redo()).toBe(false);
    });

    /** Linear history: a new edit after an undo discards the redo branch. */
    it('clears the redo stack when a new command is recorded', () => {
        const state = { value: 0 };
        const history = new History();
        history.execute(setter(state, 0, 1));
        history.undo();
        expect(history.canRedo).toBe(true);

        history.execute(setter(state, 0, 9));
        expect(history.canRedo).toBe(false);
    });

    it('drops the oldest entry past the limit', () => {
        const state = { value: 0 };
        const history = new History({ limit: 3 });
        for (let i = 0; i < 5; i++) history.execute(setter(state, i, i + 1, `k${i}`));
        expect(history.undoLabels).toHaveLength(3);
    });
});

describe('coalescing', () => {
    /**
     * The point of the whole mechanism: a drag is 300 pointer-moves and exactly one undo step,
     * spanning where the object started and where it ended.
     */
    it('merges same-key commands into one entry spanning both ends', () => {
        const state = { value: 0 };
        const history = new History();

        history.execute(setter(state, 0, 1, 'drag'));
        history.execute(setter(state, 1, 2, 'drag'));
        history.execute(setter(state, 2, 3, 'drag'));

        expect(state.value).toBe(3);
        expect(history.undoLabels).toHaveLength(1);

        history.undo();
        expect(state.value).toBe(0);
    });

    it('keeps different keys apart', () => {
        const state = { value: 0 };
        const history = new History();
        history.execute(setter(state, 0, 1, 'a'));
        history.execute(setter(state, 1, 2, 'b'));
        expect(history.undoLabels).toHaveLength(2);
    });

    it('does not merge across an unrelated command', () => {
        const state = { value: 0 };
        const history = new History();
        history.execute(setter(state, 0, 1, 'drag'));
        history.execute(
            new FunctionCommand(
                'other',
                () => {},
                () => {}
            )
        );
        history.execute(setter(state, 1, 2, 'drag'));
        expect(history.undoLabels).toHaveLength(3);
    });

    it('redoes a merged command to the merged end state', () => {
        const state = { value: 0 };
        const history = new History();
        history.execute(setter(state, 0, 1, 'drag'));
        history.execute(setter(state, 1, 5, 'drag'));
        history.undo();
        history.redo();
        expect(state.value).toBe(5);
    });
});

describe('transactions', () => {
    it('groups everything inside into one entry', () => {
        const state = { a: 0, b: 0 };
        const history = new History();

        history.transaction('move both', () => {
            history.execute(
                new FunctionCommand(
                    'a',
                    () => (state.a = 1),
                    () => (state.a = 0)
                )
            );
            history.execute(
                new FunctionCommand(
                    'b',
                    () => (state.b = 1),
                    () => (state.b = 0)
                )
            );
        });

        expect(state).toEqual({ a: 1, b: 1 });
        expect(history.undoLabels).toEqual(['move both']);

        history.undo();
        expect(state).toEqual({ a: 0, b: 0 });
    });

    it('undoes a composite in reverse order', () => {
        const order: string[] = [];
        const history = new History();
        history.transaction('t', () => {
            history.execute(
                new FunctionCommand(
                    'a',
                    () => {},
                    () => order.push('a')
                )
            );
            history.execute(
                new FunctionCommand(
                    'b',
                    () => {},
                    () => order.push('b')
                )
            );
        });
        history.undo();
        expect(order).toEqual(['b', 'a']);
    });

    it('nests without producing two entries', () => {
        const history = new History();
        history.transaction('outer', () => {
            history.transaction('inner', () => {
                history.execute(
                    new FunctionCommand(
                        'a',
                        () => {},
                        () => {}
                    )
                );
            });
            history.execute(
                new FunctionCommand(
                    'b',
                    () => {},
                    () => {}
                )
            );
        });
        expect(history.undoLabels).toEqual(['outer']);
    });

    it('records nothing for an empty transaction', () => {
        const history = new History();
        history.transaction('nothing', () => {});
        expect(history.canUndo).toBe(false);
    });

    it('collapses a single-command transaction rather than wrapping it', () => {
        const history = new History();
        history.transaction('wrapper', () => {
            history.execute(
                new FunctionCommand(
                    'inner',
                    () => {},
                    () => {}
                )
            );
        });
        expect(history.undoLabels).toEqual(['inner']);
    });

    /** A half-applied composite on the stack is worse than the original failure. */
    it('rolls back and rethrows when the body throws', () => {
        const state = { a: 0, b: 0 };
        const history = new History();

        expect(() =>
            history.transaction('doomed', () => {
                history.execute(
                    new FunctionCommand(
                        'a',
                        () => (state.a = 1),
                        () => (state.a = 0)
                    )
                );
                throw new Error('boom');
            })
        ).toThrow('boom');

        expect(state.a).toBe(0);
        expect(history.canUndo).toBe(false);
    });

    it('is usable again after a failed transaction', () => {
        const history = new History();
        expect(() =>
            history.transaction('doomed', () => {
                throw new Error('boom');
            })
        ).toThrow();
        history.execute(
            new FunctionCommand(
                'after',
                () => {},
                () => {}
            )
        );
        expect(history.undoLabels).toEqual(['after']);
    });
});

describe('reentrancy', () => {
    /** Without the guard, undoing pushes an undo of the undo and the stack never empties. */
    it('does not record commands issued while applying an undo', () => {
        const history = new History();
        const reactive = new FunctionCommand(
            'reactive',
            () => {},
            () => {
                history.execute(
                    new FunctionCommand(
                        'echo',
                        () => {},
                        () => {}
                    )
                );
            }
        );

        history.execute(reactive);
        history.undo();

        expect(history.undoLabels).toEqual([]);
        expect(history.redoLabels).toEqual(['reactive']);
    });

    it('exposes the applying flag so stores can ignore their own echo', () => {
        const history = new History();
        let sawFlag = false;
        history.execute(
            new FunctionCommand(
                'x',
                () => {},
                () => {
                    sawFlag = history.isApplying;
                }
            )
        );
        history.undo();
        expect(sawFlag).toBe(true);
        expect(history.isApplying).toBe(false);
    });
});

describe('notifications', () => {
    it('reports why the stack changed', () => {
        const listener = vi.fn();
        const history = new History();
        history.onChange.subscribe(listener);

        history.execute(
            new FunctionCommand(
                'a',
                () => {},
                () => {}
            )
        );
        history.undo();
        history.redo();
        history.clear();

        expect(listener.mock.calls.map((call) => call[0].reason)).toEqual(['execute', 'undo', 'redo', 'clear']);
    });

    it('reports a coalesce distinctly from an execute', () => {
        const state = { value: 0 };
        const listener = vi.fn();
        const history = new History();
        history.onChange.subscribe(listener);

        history.execute(setter(state, 0, 1, 'drag'));
        history.execute(setter(state, 1, 2, 'drag'));

        expect(listener.mock.calls.map((call) => call[0].reason)).toEqual(['execute', 'coalesce']);
    });
});

describe('record', () => {
    /** For a live drag, where the object has already been moved by the time the gesture ends. */
    it('records without re-executing', () => {
        const state = { value: 7 };
        const history = new History();
        history.record(setter(state, 0, 7));
        expect(state.value).toBe(7);
        history.undo();
        expect(state.value).toBe(0);
    });
});

describe('CompositeCommand', () => {
    it('is usable directly', () => {
        const order: string[] = [];
        const composite = new CompositeCommand('both', [
            new FunctionCommand(
                'a',
                () => order.push('do-a'),
                () => order.push('undo-a')
            ),
            new FunctionCommand(
                'b',
                () => order.push('do-b'),
                () => order.push('undo-b')
            ),
        ]);
        composite.execute();
        composite.undo();
        expect(order).toEqual(['do-a', 'do-b', 'undo-b', 'undo-a']);
    });
});
