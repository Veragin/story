import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import type { TLocationDto } from '@story/protocol';
import { errorMessage, isLocationDto, isStaleError } from '../../../api';
import type { IEditorSource } from '../../../components/layout/editorSource';
import { locationPatch, rebaseDraft, toLocationDraft, type TLocationDraft, type TLocationPatch } from './draft';

type TSaveLocation = (patch: TLocationPatch, version: string) => Promise<TLocationDto>;

export class LocationEditorStore implements IEditorSource {
    base: TLocationDto;
    draft: TLocationDraft;
    saving = false;
    error: string | null = null;
    conflict: TLocationDto | null = null;

    constructor(
        location: TLocationDto,
        private readonly saveLocation: TSaveLocation
    ) {
        this.base = location;
        this.draft = toLocationDraft(location);
        makeObservable(this, {
            base: observable.ref,
            draft: observable.ref,
            saving: observable,
            error: observable,
            conflict: observable.ref,
            patch: computed,
            dirty: computed,
            setDraft: action,
            discard: action,
            reloadFromDisk: action,
            keepMine: action,
            onExternal: action,
            save: action,
        });
    }

    get patch(): TLocationPatch {
        return locationPatch(this.base, this.draft);
    }

    get dirty() {
        return Object.keys(this.patch).length > 0;
    }

    get stale() {
        return this.conflict;
    }

    setDraft(change: Partial<TLocationDraft>) {
        this.draft = { ...this.draft, ...change };
        this.error = null;
    }

    discard() {
        this.draft = toLocationDraft(this.base);
        this.conflict = null;
        this.error = null;
    }

    // live refresh: follow the file silently while there is no input, otherwise ask
    onExternal(location: TLocationDto) {
        if (location.version === this.base.version || this.saving) return;
        if (this.dirty) {
            this.conflict = location;
            return;
        }
        this.base = location;
        this.draft = toLocationDraft(location);
    }

    reloadFromDisk() {
        if (!this.conflict) return;
        this.base = this.conflict;
        this.discard();
    }

    async keepMine() {
        if (!this.conflict) return;
        this.draft = rebaseDraft(this.base, this.draft, this.conflict);
        this.base = this.conflict;
        this.conflict = null;
        await this.save();
    }

    async save(): Promise<boolean> {
        const { patch, base } = this;
        if (Object.keys(patch).length === 0) return true;
        this.saving = true;
        this.error = null;
        try {
            const saved = await this.saveLocation(patch, base.version);
            runInAction(() => {
                this.base = saved;
                this.draft = toLocationDraft(saved);
                this.conflict = null;
            });
            return true;
        } catch (e) {
            runInAction(() => {
                if (isStaleError(e, isLocationDto)) this.conflict = e.current ?? base;
                else this.error = errorMessage(e);
            });
            return false;
        } finally {
            runInAction(() => (this.saving = false));
        }
    }
}
