import { useEffect, useState } from 'react';
import { Alert, Button } from '@mui/material';
import type { TGitDto, TStoryInfoDto } from '@story/protocol';
import { errorMessage, isApiError } from './api';
import type { StoriesStore } from './StoriesStore';
import { StoryFormDialog } from './StoryFormDialog';
import {
    hasErrors,
    storyFormOf,
    toGitChange,
    toUpdateBody,
    validateStoryForm,
    type TStoryFormValue,
    type TStoryGitState,
} from './storyForm';

const gitStateOf = (dto: TGitDto): TStoryGitState =>
    dto.available ? { config: dto.config } : null;

type TProps = {
    store: StoriesStore;
    storyId: string;
    onClose: () => void;
};

export const EditStoryDialog = ({ store, storyId, onClose }: TProps) => {
    const [info, setInfo] = useState<TStoryInfoDto | null>(null);
    const [git, setGit] = useState<TStoryGitState>(null);
    const [value, setValue] = useState<TStoryFormValue | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [conflict, setConflict] = useState<TStoryInfoDto | null>(null);

    useEffect(() => {
        let live = true;
        const load = async () => {
            try {
                const loaded = await store.loadInfo(storyId);
                if (!live) return;
                if (!loaded) return onClose(); // the password prompt was cancelled
                const loadedGit = await store.loadGit(storyId);
                if (!live) return;
                const gitState = loadedGit && gitStateOf(loadedGit);
                setInfo(loaded);
                setGit(gitState);
                setValue(storyFormOf(loaded, gitState));
            } catch (e) {
                if (live) setError(errorMessage(e));
            }
        };
        void load();
        return () => {
            live = false;
        };
    }, [store, storyId, onClose]);

    const errors = value
        ? validateStoryForm(value, { passwordRequired: false, git })
        : {};

    // git first: a failed push must not leave the other fields saved and the form stale
    const saveGit = async (current: TStoryFormValue) => {
        const change = toGitChange(current, git);
        if (!change) return current;
        const saved = await store.saveGit(storyId, change);
        if (!saved) return null;
        setGit(gitStateOf(saved));
        const next = { ...current, gitToken: '' };
        setValue(next);
        return next;
    };

    const save = async () => {
        if (!info || !value) return;
        setSubmitted(true);
        if (hasErrors(errors)) return;
        setSaving(true);
        setError(null);
        try {
            const current = await saveGit(value);
            if (!current) return setSaving(false);
            const saved = await store.saveInfo(
                storyId,
                toUpdateBody(current, info.version)
            );
            if (saved) return onClose();
        } catch (e) {
            if (isApiError(e) && e.isStale && e.body.current) {
                setConflict(e.body.current as TStoryInfoDto);
            } else {
                setError(errorMessage(e));
            }
        }
        setSaving(false);
    };

    const reload = () => {
        if (!conflict) return;
        setInfo(conflict);
        setValue(storyFormOf(conflict, git));
        setConflict(null);
    };

    const keepMine = () => {
        if (!conflict) return;
        setInfo(conflict);
        setConflict(null);
    };

    return (
        <StoryFormDialog
            title={_('Edit %s', store.story(storyId)?.name ?? storyId)}
            mode="edit"
            git={git}
            value={value}
            onChange={setValue}
            errors={errors}
            submitted={submitted}
            saving={saving}
            error={error}
            notice={
                conflict && (
                    <Alert
                        severity="warning"
                        sx={{ mb: 2 }}
                        action={
                            <>
                                <Button
                                    color="inherit"
                                    size="small"
                                    onClick={reload}
                                >
                                    {_('Reload')}
                                </Button>
                                <Button
                                    color="inherit"
                                    size="small"
                                    onClick={keepMine}
                                >
                                    {_('Keep mine')}
                                </Button>
                            </>
                        }
                    >
                        {_('Someone else changed this story meanwhile.')}
                    </Alert>
                )
            }
            submitLabel={_('Save')}
            savingLabel={_('Saving…')}
            submitBlocked={conflict !== null}
            onSubmit={() => void save()}
            onClose={onClose}
        />
    );
};
