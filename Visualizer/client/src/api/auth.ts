import { action, makeObservable, observable } from 'mobx';

export type TAuthOptions = {
    /** Log in to the edited story (`POST /api/stories/:id/login`); rejects with the `ApiError`. */
    login: (password: string) => Promise<void>;
    /** The story's display name for the prompt, readable without a grant (the story list). */
    storyName?: () => Promise<string | null>;
    /** What cancelling the prompt does (the app: back to the landing page). */
    onCancel?: () => void;
};

/**
 * The client's login state (multiple stories, phase 7). Every story route answers `401` without
 * a grant for the story (none yet, or it expired after 24 h). The http api then calls
 * `requireLogin()` and retries the request once when it resolves:
 *
 *  - The first 401 opens the password prompt (`prompt`, drawn by `shell/LoginPrompt.tsx` with
 *    `PasswordDialog`). Every 401 while it is open waits on the same prompt, so a page that
 *    fires ten requests shows one dialog, and all ten are retried after the login.
 *  - Cancel runs `onCancel` (back to the landing page) and rejects the waiting requests.
 *  - `onLogin` listeners run after each login: the event stream reconnects then (an
 *    `EventSource` never sees the 401 itself, see `api/index.ts`).
 */
export class AuthStore {
    /** The open prompt (with the story's name), or `null`. */
    prompt: { storyName: string } | null = null;
    private waiting: { resolve: () => void; reject: (e: unknown) => void }[] = [];
    private loginListeners = new Set<() => void>();

    constructor(
        readonly storyId: string,
        private readonly options: TAuthOptions
    ) {
        makeObservable<AuthStore, 'setPrompt'>(this, {
            prompt: observable.ref,
            setPrompt: action,
        });
    }

    /**
     * Resolves once the user has logged in through the prompt; rejects with `reason` when they
     * cancel. Opens the prompt unless it is already open.
     */
    requireLogin(reason?: unknown): Promise<void> {
        const wait = new Promise<void>((resolve, reject) =>
            this.waiting.push({ resolve, reject: () => reject(reason ?? new Error('Login cancelled')) })
        );
        if (!this.prompt) {
            this.setPrompt({ storyName: this.storyId });
            // the name shows up once known; the prompt works without it
            void this.options
                .storyName?.()
                .then((name) => {
                    if (name && this.prompt) this.setPrompt({ storyName: name });
                })
                .catch(() => undefined);
        }
        return wait;
    }

    /** The prompt's `onSubmit`: rejects (401 wrong password, 429) and stays open on failure. */
    submit = async (password: string) => {
        await this.options.login(password);
        this.settle(true);
        this.loginListeners.forEach((l) => l());
    };

    /** The prompt's `onCancel`. */
    cancel = () => {
        this.settle(false);
        this.options.onCancel?.();
    };

    /** Called after every successful login. Returns the unsubscribe. */
    onLogin(listener: () => void): () => void {
        this.loginListeners.add(listener);
        return () => {
            this.loginListeners.delete(listener);
        };
    }

    private settle(loggedIn: boolean) {
        const waiting = this.waiting.splice(0);
        this.setPrompt(null);
        for (const w of waiting) {
            if (loggedIn) w.resolve();
            else w.reject(undefined);
        }
    }

    private setPrompt(prompt: { storyName: string } | null) {
        this.prompt = prompt;
    }
}
