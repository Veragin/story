import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Container, Stack, Typography } from '@mui/material';
import { Add } from '@mui/icons-material';
import { PasswordDialog, showToast } from '@story/ui';
import { createLandingApi } from './api';
import { CreateStoryDialog } from './CreateStoryDialog';
import { StoriesStore } from './StoriesStore';
import { StoryList } from './StoryList';

export const App = observer(() => {
    const [store] = useState(() => new StoriesStore(createLandingApi()));
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        void store.load();
        void store.checkGit();
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
                    gitAvailable={store.gitAvailable}
                    onSubmit={async (body, git) => {
                        const { story, gitError } = await store.create(
                            body,
                            git
                        );
                        setCreating(false);
                        showToast(_('Created "%s"', story.name), {
                            variant: 'success',
                        });
                        if (gitError) {
                            showToast(
                                _(
                                    'Not connected to git: %s. Try again in Edit.',
                                    gitError
                                ),
                                { variant: 'warning' }
                            );
                        }
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
