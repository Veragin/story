import { useCallback, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Alert, CircularProgress, Stack, Typography } from '@mui/material';
import type { TStoryListItemDto } from '@story/protocol';
import { showToast } from '@story/ui';
import { AddStoryFilesDialog } from './AddStoryFilesDialog';
import { EditStoryDialog } from './EditStoryDialog';
import type { StoriesStore } from './StoriesStore';
import { StoryCard } from './StoryCard';

type TImport = { story: TStoryListItemDto; zip: File };

export const StoryList = observer(({ store }: { store: StoriesStore }) => {
    const [editing, setEditing] = useState<string | null>(null);
    const [importing, setImporting] = useState<TImport | null>(null);
    const closeEdit = useCallback(() => setEditing(null), []);

    const edit = async (id: string) => {
        if (await store.requireUnlocked(id)) setEditing(id);
    };

    const pickImport = async (story: TStoryListItemDto, zip: File) => {
        if (await store.requireUnlocked(story.id)) setImporting({ story, zip });
    };

    const submitImport = async ({ story, zip }: TImport) => {
        const added = await store.addFiles(story.id, zip);
        setImporting(null);
        if (!added) return;
        showToast(_('Imported %s into "%s"', zip.name, story.name), {
            variant: 'success',
        });
    };

    if (!store.loaded) return <CircularProgress size={24} />;

    return (
        <Stack spacing={2}>
            {store.error && (
                <Alert severity="error">
                    {_('Could not load the stories: %s', store.error)}
                </Alert>
            )}
            {store.stories.length === 0 && !store.error && (
                <Typography color="text.secondary">
                    {_('No stories yet. Create one.')}
                </Typography>
            )}
            {store.stories.map((story) => (
                <StoryCard
                    key={story.id}
                    story={story}
                    onEdit={() => void edit(story.id)}
                    onOpen={() => void store.open(story.id)}
                    onPlay={() => store.play(story.id)}
                    onExport={() => void store.exportStory(story.id)}
                    onExportWeb={() => void store.exportForWeb(story.id)}
                    onImport={(zip) => void pickImport(story, zip)}
                />
            ))}
            {importing && (
                <AddStoryFilesDialog
                    storyName={importing.story.name}
                    fileName={importing.zip.name}
                    onSubmit={() => submitImport(importing)}
                    onClose={() => setImporting(null)}
                />
            )}
            {editing && (
                <EditStoryDialog
                    store={store}
                    storyId={editing}
                    onClose={closeEdit}
                />
            )}
        </Stack>
    );
});
