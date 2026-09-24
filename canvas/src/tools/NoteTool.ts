import { Observer, type TColor } from '@story/shared';
import { NoteObject } from '../objects/NoteObject';
import type { TPointerEvent } from '../renderer/types';
import { BaseTool } from './Tool';

/**
 * Places and edits a note (VISUALIZER_PLAN §3.2 `tools/NoteTool.ts`; README: "notes — draw a
 * river and name it").
 *
 * ## Why the tool does not own a text input
 *
 * Typing happens in the host's UI, not on the canvas. `@story/canvas` has exactly one React
 * file by design (§3.1), and a canvas-native text editor would mean re-implementing carets,
 * selection, IME and clipboard — which is a text engine, not a story tool. So the tool *asks*:
 * it emits `onEditRequested` with the note and a `commit` callback, the host shows whatever
 * input it already has (the Visualizer has an MUI dialog), and calls back.
 *
 * That split is also what makes the tool testable against the fake renderer: a test drives the
 * placement and calls `commit` directly, with no DOM in the loop.
 */

export type TNoteToolOptions = {
    color?: TColor;
    /** Screen pixels. */
    fontSize?: number;
    /** Text a freshly-placed note starts with, before the host asks for the real thing. */
    placeholder?: string;
    generateId?: () => string;
};

export type TNoteEditRequest = {
    note: NoteObject;
    /** True when the note was placed by this gesture and has never had real text. */
    isNew: boolean;
    /** Call with the final text. An empty string removes a new note instead of keeping it. */
    commit: (text: string) => void;
    /** Call to abandon the edit — removes a new note, leaves an existing one untouched. */
    cancel: () => void;
};

let sequence = 0;

export class NoteTool extends BaseTool {
    readonly name = 'note';
    readonly cursor = 'text';

    /** The host answers this by showing a text input. */
    readonly onEditRequested = new Observer<TNoteEditRequest>();
    readonly onCreated = new Observer<NoteObject>();

    color: TColor;
    fontSize: number;

    private readonly placeholder: string;
    private readonly generateId: () => string;
    /** The note currently awaiting text, so a second click cannot start a second edit. */
    private pending: NoteObject | null = null;

    constructor(options: TNoteToolOptions = {}) {
        super();
        this.color = options.color ?? '#ffffff';
        this.fontSize = options.fontSize ?? 14;
        this.placeholder = options.placeholder ?? '…';
        this.generateId = options.generateId ?? (() => `note-${++sequence}`);
    }

    protected onCancel(): void {
        // A note left waiting for text it never got is removed: an empty note is invisible and
        // would accumulate in `data/` every time the author changed their mind.
        if (this.pending) this.scene.remove(this.pending);
        this.pending = null;
    }

    onPointerDown(event: TPointerEvent): boolean | void {
        if (this.pending) return true;

        // Clicking an existing note edits it rather than stacking a new one on top.
        const hit = this.scene.hitTest(event.world, (object) => object instanceof NoteObject);
        if (hit instanceof NoteObject) {
            this.requestEdit(hit, false);
            return true;
        }

        const note = new NoteObject({
            id: this.generateId(),
            position: this.snapping.snapToGrid(event.world),
            text: this.placeholder,
            color: this.color,
            fontSize: this.fontSize,
            // On `overlay` until it has real text, then promoted to `content` in `commit`.
            //
            // The note is added to the scene immediately so the author can see where it will
            // land while they type. That makes it visible to anything walking the scene — and
            // a host that saves the map while the dialog is open would otherwise write the
            // placeholder into `data/` as a real note. `overlay` is already defined as tool
            // furniture that is never content, so putting it there makes that mistake
            // unrepresentable rather than merely unlikely.
            layer: 'overlay',
            selectable: false,
        });
        this.scene.add(note);
        this.pending = note;
        this.requestEdit(note, true);
        return true;
    }

    /** Opens the editor for a note the host already has a reference to. */
    edit(note: NoteObject): void {
        this.requestEdit(note, false);
    }

    private requestEdit(note: NoteObject, isNew: boolean): void {
        const previousText = note.text;

        const commit = (text: string) => {
            const trimmed = text.trim();
            this.pending = null;

            if (isNew) {
                if (trimmed.length === 0) {
                    this.scene.remove(note);
                    return;
                }
                note.text = trimmed;
                // Promoted out of `overlay`: it is content now.
                this.scene.remove(note);
                note.layer = 'content';
                note.selectable = true;
                this.scene.add(note);
                this.history.record({
                    label: 'Add note',
                    execute: () => this.scene.add(note),
                    undo: () => this.scene.remove(note),
                });
                this.selection.set([note]);
                this.onCreated.notify(note);
                return;
            }

            if (trimmed === previousText) return;
            if (trimmed.length === 0) {
                // Clearing an existing note's text deletes it, which is the only way to remove
                // one from inside the editor.
                this.history.record({
                    label: 'Delete note',
                    execute: () => this.scene.remove(note),
                    undo: () => this.scene.add(note),
                });
                this.scene.remove(note);
                return;
            }

            note.text = trimmed;
            this.history.record({
                label: 'Edit note',
                execute: () => {
                    note.text = trimmed;
                },
                undo: () => {
                    note.text = previousText;
                },
            });
        };

        const cancel = () => {
            this.pending = null;
            if (isNew) this.scene.remove(note);
        };

        this.onEditRequested.notify({ note, isNew, commit, cancel });
    }
}
