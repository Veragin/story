import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import {
    AI_MESSAGE_MAX_LENGTH,
    type TAiDto,
    type TAiEvent,
    type TAiMessageDto,
    type TAiSessionDto,
    type TAiStatus,
} from '@story/protocol';
import { ApiError, errorMessage, type TVisualizerApi } from '../api';
import type { TAiEventsConnection } from '../api/aiEvents';
import type { AuthStore } from '../api/auth';
import type { EntityStore } from '../stores/EntityStore';
import { RefCountedSubscription } from '../stores/RefCountedSubscription';
import { getUiState, setUiState } from '../ui-state';
import { formatMention, type TMentionClass } from './aiMentions';
import { AiSuggestStore } from './AiSuggestStore';
import { findActiveToken, replaceToken } from './aiToken';
import { PassageIndex, type TPassageIndex } from './PassageIndex';

type TAiStoreOptions = {
    api: TVisualizerApi;
    auth?: Pick<AuthStore, 'onLogin'>;
    entities?: Pick<EntityStore, 'project' | 'start'>;
    passages?: TPassageIndex;
};

export const AI_OPEN_KEY = 'aiSidebarOpen';

const LOCAL_ID_PREFIX = 'local-';

const LOCKED_STATUSES: readonly TAiStatus[] = ['unavailable', 'disabled', 'no_credits', 'starting', 'busy'];

const isLocal = (message: TAiMessageDto) => message.id.startsWith(LOCAL_ID_PREFIX);

export class AiStore {
    open: boolean;
    available = false;
    imageGeneration = false;
    enabled = false;
    status: TAiStatus = 'stopped';
    statusMessage: string | null = null;
    credits = 0;
    messages: TAiMessageDto[] = [];
    sessionId: string | null = null;
    draft = '';
    lastError: string | null = null;
    sessions: TAiSessionDto[] = [];
    touchedFiles: string[] = [];
    sending = false;
    focusRequest = 0;

    readonly suggest: AiSuggestStore;
    readonly passages: TPassageIndex;

    private readonly api: TVisualizerApi;
    private readonly auth?: Pick<AuthStore, 'onLogin'>;
    private readonly entities?: Pick<EntityStore, 'project' | 'start'>;
    private readonly subscription: RefCountedSubscription;
    private connection: TAiEventsConnection | null = null;
    private localCounter = 0;
    private loadToken = 0;

    constructor({ api, auth, entities, passages }: TAiStoreOptions) {
        this.api = api;
        this.auth = auth;
        this.entities = entities;
        this.passages = passages ?? new PassageIndex({ api, entities });
        this.open = getUiState<unknown>(AI_OPEN_KEY, false) === true;
        this.subscription = new RefCountedSubscription(() => this.subscribe());
        makeObservable<AiStore, 'applyDto' | 'syncConnection'>(this, {
            open: observable,
            available: observable,
            imageGeneration: observable,
            enabled: observable,
            status: observable,
            statusMessage: observable,
            credits: observable,
            messages: observable.shallow,
            sessionId: observable,
            draft: observable,
            lastError: observable,
            sessions: observable.ref,
            touchedFiles: observable.ref,
            sending: observable,
            focusRequest: observable,
            visible: computed,
            noCredits: computed,
            working: computed,
            locked: computed,
            canSend: computed,
            setOpen: action,
            toggle: action,
            setDraft: action,
            setCredits: action,
            requestFocus: action,
            insertMention: action,
            clearError: action,
            applyEvent: action,
            applyDto: action,
            syncConnection: action,
        });
        this.suggest = new AiSuggestStore({ host: this, entities, passages: this.passages });
    }

    get visible(): boolean {
        return this.open && this.available && this.enabled;
    }

    get noCredits(): boolean {
        return this.credits <= 0 || this.status === 'no_credits';
    }

    get working(): boolean {
        return this.status === 'busy' || this.status === 'starting';
    }

    get locked(): boolean {
        return this.sending || this.noCredits || LOCKED_STATUSES.includes(this.status);
    }

    get canSend(): boolean {
        const length = this.draft.trim().length;
        return !this.locked && length > 0 && length <= AI_MESSAGE_MAX_LENGTH;
    }

    start = (): (() => void) => this.subscription.acquire();

    setOpen = (open: boolean) => {
        this.open = open;
        setUiState(AI_OPEN_KEY, open);
        this.syncConnection();
    };

    toggle = () => this.setOpen(!this.open);

    setDraft = (draft: string) => {
        this.draft = draft;
    };

    setCredits = (credits: number) => {
        this.credits = credits;
    };

    requestFocus = () => {
        this.focusRequest++;
    };

    insertMention = (mentionClass: TMentionClass, id: string) => {
        const mention = `${formatMention(mentionClass, id)} `;
        const token = findActiveToken(this.draft);
        if (token?.trigger === '@') this.draft = replaceToken(this.draft, token, mention);
        else this.draft = this.draft === '' || /\s$/.test(this.draft) ? this.draft + mention : `${this.draft} ${mention}`;
        this.requestFocus();
    };

    clearError = () => {
        this.lastError = null;
    };

    load = async (): Promise<void> => {
        const token = ++this.loadToken;
        try {
            const dto = await this.api.getAi();
            if (token === this.loadToken) this.applyDto(dto);
        } catch (e) {
            if (token !== this.loadToken) return;
            runInAction(() => {
                this.available = false;
                this.imageGeneration = false;
                if (!(e instanceof ApiError && (e.code === 'ai_unavailable' || e.code === 'ai_disabled'))) {
                    console.error('[ai] could not load the agent state', e);
                }
            });
            this.syncConnection();
        }
    };

    send = async (text: string = this.draft): Promise<boolean> => {
        const trimmed = text.trim();
        if (trimmed === '' || trimmed.length > AI_MESSAGE_MAX_LENGTH || this.locked) return false;
        const optimistic: TAiMessageDto = {
            kind: 'user',
            id: `${LOCAL_ID_PREFIX}${++this.localCounter}`,
            text: trimmed,
            at: new Date().toISOString(),
        };
        runInAction(() => {
            this.messages.push(optimistic);
            this.draft = '';
            this.lastError = null;
            this.sending = true;
        });
        try {
            await this.api.sendAiMessage({ text: trimmed });
            return true;
        } catch (e) {
            runInAction(() => {
                this.messages = this.messages.filter((m) => m.id !== optimistic.id);
                if (this.draft === '') this.draft = trimmed;
                this.lastError = errorMessage(e);
                if (e instanceof ApiError && e.code === 'ai_no_credits') this.status = 'no_credits';
            });
            return false;
        } finally {
            runInAction(() => (this.sending = false));
        }
    };

    interrupt = async (): Promise<void> => {
        try {
            await this.api.interruptAi();
        } catch (e) {
            runInAction(() => (this.lastError = errorMessage(e)));
        }
    };

    clear = async (): Promise<void> => {
        try {
            await this.api.clearAi();
        } catch (e) {
            runInAction(() => (this.lastError = errorMessage(e)));
        }
    };

    loadSessions = async (): Promise<void> => {
        try {
            const sessions = await this.api.listAiSessions();
            runInAction(() => (this.sessions = sessions));
        } catch (e) {
            runInAction(() => (this.lastError = errorMessage(e)));
        }
    };

    resume = async (sessionId: string): Promise<void> => {
        try {
            await this.api.resumeAi({ sessionId });
        } catch (e) {
            runInAction(() => (this.lastError = errorMessage(e)));
        }
    };

    applyEvent = (event: TAiEvent) => {
        switch (event.type) {
            case 'snapshot':
                this.status = event.status;
                this.statusMessage = null;
                this.credits = event.credits;
                this.sessionId = event.sessionId;
                this.messages = event.messages;
                this.touchedFiles = event.touchedFiles;
                break;
            case 'status':
                this.status = event.status;
                this.statusMessage = event.message ?? null;
                break;
            case 'message':
                this.addMessage(event.message);
                break;
            case 'activity':
                this.touchedFiles = event.touchedFiles;
                break;
            case 'usage':
            case 'credits':
                this.credits = event.credits;
                break;
        }
    };

    private addMessage(message: TAiMessageDto) {
        const echoed =
            message.kind === 'user'
                ? this.messages.findIndex((m) => isLocal(m) && m.kind === 'user' && m.text === message.text)
                : -1;
        const index = echoed >= 0 ? echoed : this.messages.findIndex((m) => m.id === message.id);
        if (index >= 0) this.messages[index] = message;
        else this.messages.push(message);
    }

    private applyDto(dto: TAiDto) {
        this.available = dto.available;
        this.imageGeneration = dto.imageGeneration;
        this.enabled = dto.enabled;
        this.credits = dto.credits;
        this.status = dto.status;
        this.sessionId = dto.sessionId;
        this.syncConnection();
    }

    private syncConnection() {
        if (this.visible && this.subscription.active && !this.connection) {
            this.connection = this.api.aiEvents((event) => this.applyEvent(event));
        } else if (!(this.visible && this.subscription.active) && this.connection) {
            this.disconnect();
        }
    }

    private disconnect() {
        this.connection?.close();
        this.connection = null;
        this.touchedFiles = [];
    }

    private subscribe() {
        void this.load();
        const offs = [() => runInAction(() => this.disconnect())];
        if (this.entities) offs.push(this.entities.start());
        if (this.auth) {
            offs.push(
                this.auth.onLogin(() => {
                    this.connection?.reconnectNow();
                    void this.load();
                })
            );
        }
        return offs;
    }
}
