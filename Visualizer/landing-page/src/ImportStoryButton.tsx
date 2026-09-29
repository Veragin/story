import { useRef, useState } from 'react';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
} from '@mui/material';
import { FileUpload } from '@mui/icons-material';
import { isStoryId, STORY_ZIP_CONTENT_TYPE } from '@story/visualizer-protocol';
import { showToast } from '@story/ui';
import { isApiError } from './api';
import type { StoriesStore } from './StoriesStore';

/** A story id from a zip's file name: `My Story (2).zip` → `my-story-2`. */
const storyIdFromFileName = (fileName: string) =>
    fileName
        .replace(/\.zip$/i, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64)
        .replace(/-+$/, '') || 'imported-story';

type TPending = { file: File; id: string; error: string };

/**
 * "Import": pick a zip (as made by Export) and POST it under an id made from its file name. When
 * that fails — the id is taken (`409 exists`), or the zip is refused — a dialog shows why, with
 * the id to change and a retry. The imported story keeps the zip's password.
 */
export const ImportStoryButton = ({ store }: { store: StoriesStore }) => {
    const input = useRef<HTMLInputElement>(null);
    const [pending, setPending] = useState<TPending | null>(null);
    const [busy, setBusy] = useState(false);

    const upload = async (file: File, id: string) => {
        setBusy(true);
        try {
            const story = await store.importZip(file, id);
            setPending(null);
            showToast(_('Imported "%s"', story.name), { variant: 'success' });
        } catch (e) {
            const error =
                isApiError(e) && e.isExists
                    ? _(
                          'A story "%s" already exists. Import it under another id.',
                          id
                      )
                    : (e as Error).message;
            setPending({ file, id, error });
        } finally {
            setBusy(false);
        }
    };

    const pick = (file: File | undefined) => {
        if (input.current) input.current.value = ''; // picking the same file again fires again
        if (file) void upload(file, storyIdFromFileName(file.name));
    };

    const idValid = pending !== null && isStoryId(pending.id);

    return (
        <>
            <Button
                variant="outlined"
                startIcon={<FileUpload />}
                onClick={() => input.current?.click()}
                disabled={busy}
            >
                {_('Import')}
            </Button>
            <input
                ref={input}
                type="file"
                accept={`.zip,${STORY_ZIP_CONTENT_TYPE}`}
                hidden
                onChange={(e) => pick(e.target.files?.[0])}
            />
            {pending && (
                <Dialog
                    open
                    onClose={busy ? undefined : () => setPending(null)}
                    maxWidth="xs"
                    fullWidth
                >
                    <DialogTitle>
                        {_('Import %s', pending.file.name)}
                    </DialogTitle>
                    <DialogContent>
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {pending.error}
                        </Alert>
                        <TextField
                            label={_('Story id')}
                            value={pending.id}
                            onChange={(e) =>
                                setPending({ ...pending, id: e.target.value })
                            }
                            error={!idValid}
                            helperText={_(
                                'Lowercase letters, digits and "-", at most 64 characters'
                            )}
                            disabled={busy}
                            autoFocus
                            fullWidth
                            margin="dense"
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button
                            color="inherit"
                            onClick={() => setPending(null)}
                            disabled={busy}
                        >
                            {_('Cancel')}
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() =>
                                void upload(pending.file, pending.id)
                            }
                            disabled={busy || !idValid}
                        >
                            {_('Import')}
                        </Button>
                    </DialogActions>
                </Dialog>
            )}
        </>
    );
};
