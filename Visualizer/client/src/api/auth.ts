import { action, makeObservable, observable } from 'mobx';

export type TAuthOptions = {
    login: (password: string) => Promise<void>;
    storyName?: () => Promise<string | null>;
    onCancel?: () => void;
};

export class AuthStore {
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

    requireLogin(reason?: unknown): Promise<void> {
        const wait = new Promise<void>((resolve, reject) =>
            this.waiting.push({ resolve, reject: () => reject(reason ?? new Error('Login cancelled')) })
        );
        if (!this.prompt) {
            this.setPrompt({ storyName: this.storyId });
            void this.loadStoryName();
        }
        return wait;
    }

    private async loadStoryName() {
        try {
            const name = await this.options.storyName?.();
            if (name && this.prompt) this.setPrompt({ storyName: name });
        } catch {
            // the prompt works without the name
        }
    }

    submit = async (password: string) => {
        await this.options.login(password);
        this.settle(true);
        this.loginListeners.forEach((l) => l());
    };

    cancel = () => {
        this.settle(false);
        this.options.onCancel?.();
    };

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
