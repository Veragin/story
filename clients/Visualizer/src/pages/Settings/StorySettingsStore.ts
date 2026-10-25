import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import type { TEditStoryInfoDto } from '@story/protocol';
import {
    hasErrors,
    storyFormOf,
    toUpdateBody,
    validateStoryForm,
    type TStoryFormErrors,
    type TStoryFormValue,
} from '@story/ui';
import { ApiError, errorMessage, type TVisualizerApi } from '../../api';
import type { AuthStore } from '../../api/auth';
import type { GitStore } from '../../git/GitStore';
import type { StoryInfoStore } from '../../shell/storyInfoStore';

type TStorySettingsStoreOptions = {
    api: TVisualizerApi;
    auth: Pick<AuthStore, 'requireLogin'>;
    storyInfo: Pick<StoryInfoStore, 'reload'>;
    git: Pick<GitStore, 'refresh'>;
};

const isEditInfo = (value: unknown): value is TEditStoryInfoDto =>
    typeof value === 'object' && value !== null && 'access' in value && value.access === 'edit';

export class StorySettingsStore {
    info: TEditStoryInfoDto | null = null;
    value: TStoryFormValue | null = null;
    submitted = false;
    saving = false;
    error: string | null = null;
    conflict: TEditStoryInfoDto | null = null;

    constructor(private readonly options: TStorySettingsStoreOptions) {
        makeObservable<StorySettingsStore, 'applyInfo' | 'fail'>(this, {
            info: observable.ref,
            value: observable.ref,
            submitted: observable,
            saving: observable,
            error: observable,
            conflict: observable.ref,
            errors: computed,
            submitBlocked: computed,
            setValue: action,
            reload: action,
            keepMine: action,
            applyInfo: action,
            fail: action,
        });
    }

    get errors(): TStoryFormErrors {
        return this.value ? validateStoryForm(this.value, { passwordRequired: false }) : {};
    }

    get submitBlocked(): boolean {
        return this.value === null || this.conflict !== null || (this.submitted && hasErrors(this.errors));
    }

    setValue = (value: TStoryFormValue) => {
        this.value = value;
    };

    load = async (): Promise<void> => {
        try {
            this.applyInfo(await this.fetchEditInfo());
        } catch (e) {
            this.fail(e);
        }
    };

    save = async (): Promise<boolean> => {
        const { info, value } = this;
        if (!info || !value || this.saving) return false;
        runInAction(() => (this.submitted = true));
        if (this.submitBlocked) return false;
        runInAction(() => {
            this.saving = true;
            this.error = null;
        });
        try {
            this.applyInfo(await this.options.api.updateStoryInfo(toUpdateBody(value, info.version)));
            // the git author email follows a changed story email
            await Promise.all([this.options.storyInfo.reload(), this.options.git.refresh()]);
            return true;
        } catch (e) {
            if (e instanceof ApiError && e.isStale && isEditInfo(e.current)) {
                const current = e.current;
                runInAction(() => (this.conflict = current));
            } else {
                this.fail(e);
            }
            return false;
        } finally {
            runInAction(() => (this.saving = false));
        }
    };

    reload = () => {
        if (!this.conflict) return;
        this.applyInfo(this.conflict);
    };

    keepMine = () => {
        if (!this.conflict) return;
        this.info = this.conflict;
        this.conflict = null;
    };

    private fetchEditInfo = async (): Promise<TEditStoryInfoDto> => {
        const info = await this.options.api.getStoryInfo();
        if (info.access === 'edit') return info;
        await this.options.auth.requireLogin();
        const unlocked = await this.options.api.getStoryInfo();
        if (unlocked.access === 'edit') return unlocked;
        throw new Error(_('The story settings need the story password.'));
    };

    private applyInfo(info: TEditStoryInfoDto) {
        this.info = info;
        this.value = storyFormOf(info);
        this.submitted = false;
        this.conflict = null;
        this.error = null;
    }

    private fail(e: unknown) {
        this.error = errorMessage(e);
    }
}
