import { action, computed, makeObservable, observable, reaction } from 'mobx';
import type { EntityStore } from '../stores/EntityStore';
import { commandSuggestions } from './aiCommands';
import { mentionSuggestions, splitMention, type TMentionClass, type TMentionResult, type TPassageSource } from './aiMentions';
import { commonPrefix, findActiveToken, replaceToken, tokenText, type TActiveToken, type TSuggestion } from './aiToken';
import type { AiStore } from './AiStore';

export const SUGGESTION_LIMIT = 20;
export const PASSAGE_SUGGESTION_LIMIT = 10;

const PASSAGE_CLASS: TMentionClass = 'passage';

type TAiSuggestStoreOptions = {
    host: Pick<AiStore, 'draft' | 'locked' | 'visible' | 'setDraft' | 'requestFocus'>;
    entities?: Pick<EntityStore, 'project'>;
    passages?: TPassageSource;
};

const NO_MENTION: TMentionResult = { mentionClass: null, matches: [] };

export class AiSuggestStore {
    activeIndex: number | null = null;
    dismissedToken: string | null = null;

    private readonly host: TAiSuggestStoreOptions['host'];
    private readonly entities?: Pick<EntityStore, 'project'>;
    private readonly passages?: TPassageSource;

    constructor({ host, entities, passages }: TAiSuggestStoreOptions) {
        this.host = host;
        this.entities = entities;
        this.passages = passages;
        makeObservable<AiSuggestStore, 'mention' | 'active'>(this, {
            activeIndex: observable,
            dismissedToken: observable,
            token: computed,
            text: computed,
            mention: computed,
            active: computed,
            mentionClass: computed,
            matches: computed,
            items: computed,
            selected: computed,
            loadingPassages: computed,
            awaitingPassage: computed,
            open: computed,
            move: action,
            accept: action,
            complete: action,
            dismiss: action,
        });
        reaction(
            () => this.text,
            (text) => {
                this.activeIndex = null;
                if (text === null) this.dismissedToken = null;
            }
        );
        reaction(
            () => this.mention.mentionClass === 'passage',
            (wantsPassages) => {
                if (wantsPassages) this.passages?.load();
            }
        );
    }

    get token(): TActiveToken | null {
        return findActiveToken(this.host.draft);
    }

    get text(): string | null {
        return this.token ? tokenText(this.host.draft, this.token) : null;
    }

    private get mention(): TMentionResult {
        if (this.token?.trigger !== '@') return NO_MENTION;
        return mentionSuggestions(this.token.query, {
            project: this.entities?.project ?? null,
            passages: this.passages?.passages ?? [],
        });
    }

    get mentionClass(): TMentionClass | null {
        return this.mention.mentionClass;
    }

    get matches(): TSuggestion[] {
        if (!this.token) return [];
        return this.token.trigger === '/' ? commandSuggestions(this.token.query) : this.mention.matches;
    }

    get items(): TSuggestion[] {
        const passagesCapped = this.mention.mentionClass === 'passage' && !this.passages?.inChapter;
        return this.matches.slice(0, passagesCapped ? PASSAGE_SUGGESTION_LIMIT : SUGGESTION_LIMIT);
    }

    get selected(): number | null {
        return this.activeIndex !== null && this.activeIndex < this.items.length ? this.activeIndex : null;
    }

    get loadingPassages(): boolean {
        return this.mention.mentionClass === 'passage' && (this.passages?.loading ?? false);
    }

    get awaitingPassage(): boolean {
        if (!this.host.visible || !this.passages?.inChapter || !this.token || !this.active) return false;
        if (this.token.trigger !== '@') return false;
        const { className, entryQuery } = splitMention(this.token.query.toLowerCase());
        return entryQuery === null ? PASSAGE_CLASS.startsWith(className) : className === PASSAGE_CLASS;
    }

    get open(): boolean {
        if (!this.active) return false;
        return (
            this.items.length > 0 || this.mention.mentionClass !== null || this.loadingPassages || this.awaitingPassage
        );
    }

    private get active(): boolean {
        return this.text !== null && !this.host.locked && this.text !== this.dismissedToken;
    }

    move = (delta: 1 | -1) => {
        const count = this.items.length;
        if (count === 0) return;
        this.activeIndex =
            this.selected === null ? (delta > 0 ? 0 : count - 1) : (this.selected + delta + count) % count;
    };

    accept = (index: number | null = this.selected) => {
        const item = this.items[index ?? 0];
        if (!item) return;
        this.insert(item.continues ? item.value : `${item.value} `);
    };

    complete = () => {
        if (this.selected !== null || this.matches.length === 1) {
            this.accept();
            return;
        }
        const prefix = commonPrefix(this.matches.map((m) => m.value));
        const typed = (this.text ?? '').toLowerCase();
        if (prefix.length > typed.length && prefix.toLowerCase().startsWith(typed)) this.insert(prefix);
        else this.accept(0);
    };

    dismiss = () => {
        this.dismissedToken = this.text;
        this.activeIndex = null;
    };

    private insert(text: string) {
        if (!this.token) return;
        this.host.setDraft(replaceToken(this.host.draft, this.token, text));
        this.host.requestFocus();
    }
}
