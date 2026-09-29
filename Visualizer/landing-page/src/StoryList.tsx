import { useCallback, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Alert, CircularProgress, Stack, Typography } from '@mui/material';
import { EditStoryDialog } from './EditStoryDialog';
import type { StoriesStore } from './StoriesStore';
import { StoryCard } from './StoryCard';

/** Every story, one `StoryCard` each, and the Edit dialog of the one being edited. */
export const StoryList = observer(({ store }: { store: StoriesStore }) => {
    const [editing, setEditing] = useState<string | null>(null);
    const closeEdit = useCallback(() => setEditing(null), []);

    const edit = async (id: string) => {
        if (await store.requireUnlocked(id)) setEditing(id);
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
                    {_('No stories yet. Create one, or import a zip.')}
                </Typography>
            )}
            {store.stories.map((story) => (
                <StoryCard
                    key={story.id}
                    story={story}
                    onEdit={() => void edit(story.id)}
                    onOpen={() => void store.open(story.id)}
                    onPlay={() => void store.play(story.id)}
                    onExport={() => void store.exportStory(story.id)}
                />
            ))}
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
