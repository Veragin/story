import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Container, Stack, Typography } from '@mui/material';
import { Add } from '@mui/icons-material';
import { PasswordDialog, showToast } from '@story/ui';
import { createLandingApi } from './api';
import { CreateStoryDialog } from './CreateStoryDialog';
import { ImportStoryButton } from './ImportStoryButton';
import { StoriesStore } from './StoriesStore';
import { StoryList } from './StoryList';

export const App = observer(() => {
    const [store] = useState(() => new StoriesStore(createLandingApi()));
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        void store.load();
        // logins elsewhere and expiring grants change the `unlocked` flags
        const refresh = () => void store.load();
        window.addEventListener('focus', refresh);
        return () => window.removeEventListener('focus', refresh);
    }, [store]);

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Stack
                direction="row"
                alignItems="center"
                spacing={2}
                sx={{ mb: 3 }}
            >
                <Typography variant="h4" component="h1" sx={{ flex: 1 }}>
                    {_('Stories')}
                </Typography>
                <ImportStoryButton store={store} />
                <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setCreating(true)}
                >
                    {_('New story')}
                </Button>
            </Stack>
            <StoryList store={store} />
            {creating && (
                <CreateStoryDialog
                    onSubmit={async (body) => {
                        const story = await store.create(body);
                        setCreating(false);
                        showToast(_('Created "%s"', story.name), {
                            variant: 'success',
                        });
                    }}
                    onClose={() => setCreating(false)}
                />
            )}
            <PasswordDialog
                open={store.prompt !== null}
                storyName={store.prompt?.name ?? ''}
                onSubmit={(password) => store.submitPassword(password)}
                onCancel={() => store.cancelPassword()}
            />
        </Container>
    );
});
