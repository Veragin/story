import { useEffect, useState } from 'react';
import {
    Alert,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
} from '@mui/material';
import type { TStoryInfoDto } from '@story/visualizer-protocol';
import { isApiError } from './api';
import type { StoriesStore } from './StoriesStore';
import { StoryFormFields } from './StoryFormFields';
import {
    hasErrors,
    storyFormOf,
    toUpdateBody,
    validateStoryForm,
    type TStoryFormValue,
} from './storyForm';

type TProps = {
    store: StoriesStore;
    storyId: string;
    onClose: () => void;
};

/**
 * "Edit story": the create form over `GET/PUT /api/stories/:id/info`, with the password optional
 * ("leave empty to keep") and the map size read-only. The caller has unlocked the story already.
 * A `409 stale` (someone saved meanwhile) offers the usual "Reload / Keep mine".
 */
export const EditStoryDialog = ({ store, storyId, onClose }: TProps) => {
    const [info, setInfo] = useState<TStoryInfoDto | null>(null);
    const [value, setValue] = useState<TStoryFormValue | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** On the server now, when it changed under the form. */
    const [conflict, setConflict] = useState<TStoryInfoDto | null>(null);

    useEffect(() => {
        let live = true;
        store.loadInfo(storyId).then(
            (loaded) => {
                if (!live) return;
                if (!loaded) return onClose(); // the password prompt was cancelled
                setInfo(loaded);
                setValue(storyFormOf(loaded));
            },
            (e: Error) => live && setError(e.message)
        );
        return () => {
            live = false;
        };
    }, [store, storyId, onClose]);

    const errors = value
        ? validateStoryForm(value, { passwordRequired: false })
        : {};

    const save = async () => {
        if (!info || !value) return;
        setSubmitted(true);
        if (hasErrors(errors)) return;
        setSaving(true);
        setError(null);
        try {
            const saved = await store.saveInfo(
                storyId,
                toUpdateBody(value, info.version)
            );
            if (saved) return onClose();
        } catch (e) {
            if (isApiError(e) && e.isStale && e.body.current) {
                setConflict(e.body.current as TStoryInfoDto);
            } else {
                setError((e as Error).message);
            }
        }
        setSaving(false);
    };

    /** Take the server's version into the form. */
    const reload = () => {
        if (!conflict) return;
        setInfo(conflict);
        setValue(storyFormOf(conflict));
        setConflict(null);
    };

    /** Keep the form; the next Save overwrites the server's version. */
    const keepMine = () => {
        if (!conflict) return;
        setInfo(conflict);
        setConflict(null);
    };

    return (
        <Dialog
            open
            onClose={saving ? undefined : onClose}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>
                {_('Edit %s', store.story(storyId)?.name ?? storyId)}
            </DialogTitle>
            <DialogContent dividers>
                {conflict && (
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
                )}
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}
                {value ? (
                    <StoryFormFields
                        value={value}
                        onChange={setValue}
                        errors={submitted ? errors : {}}
                        mode="edit"
                        disabled={saving}
                    />
                ) : (
                    !error && <CircularProgress size={24} />
                )}
            </DialogContent>
            <DialogActions>
                <Button color="inherit" onClick={onClose} disabled={saving}>
                    {_('Cancel')}
                </Button>
                <Button
                    variant="contained"
                    onClick={() => void save()}
                    disabled={
                        !value ||
                        saving ||
                        conflict !== null ||
                        (submitted && hasErrors(errors))
                    }
                >
                    {saving ? _('Saving…') : _('Save')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
