import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Container, Stack, Typography } from '@mui/material';
import { Add } from '@mui/icons-material';
import type { TCreateStoryBody, TSetupGitBody } from '@story/protocol';
import { PasswordDialog, ResetPasswordDialog, showToast } from '@story/ui';
import { createLandingApi } from './api';
import { CreateStoryPage } from './CreateStoryPage';
import { dropResetLink, readResetLink, type TResetLink } from './resetLink';
import { StoriesStore } from './StoriesStore';
import { StoryList } from './StoryList';
import { useHashView } from './useHashView';

export const App = observer(() => {
    const [store] = useState(() => new StoriesStore(createLandingApi()));
    const { view, navigate } = useHashView();
    const [resetLink, setResetLink] = useState(() =>
        readResetLink(window.location.search)
    );

    useEffect(() => {
        void store.load();
        void store.checkGit();
        // logins elsewhere and expiring grants change the `unlocked` flags
        const refresh = () => void store.load();
        window.addEventListener('focus', refresh);
        return () => window.removeEventListener('focus', refresh);
    }, [store]);

    const storyName = (id: string) => store.story(id)?.name ?? id;

    const create = async (
        body: TCreateStoryBody,
        git: TSetupGitBody | null
    ) => {
        const { story, gitError } = await store.create(body, git);
        navigate('list');
        showToast(_('Created "%s"', story.name), { variant: 'success' });
        if (gitError) {
            showToast(
                _(
                    "Not connected to git: %s. Connect it in the editor's git settings.",
                    gitError
                ),
                {
                    variant: 'warning',
                }
            );
        }
    };

    const closeReset = () => {
        dropResetLink();
        setResetLink(null);
    };

    const resetPassword = async (
        { storyId, token }: TResetLink,
        password: string
    ) => {
        await store.resetPassword(storyId, token, password);
        closeReset();
        showToast(_('New password set for "%s"', storyName(storyId)), {
            variant: 'success',
        });
    };

    return (
        <>
            {view === 'new' ? (
                <CreateStoryPage
                    gitAvailable={store.gitAvailable}
                    onSubmit={create}
                    onClose={() => navigate('list')}
                />
            ) : (
                <Container maxWidth="md" sx={{ py: 4 }}>
                    <Stack
                        direction="row"
                        alignItems="center"
                        spacing={2}
                        sx={{ mb: 3 }}
                    >
                        <Typography
                            variant="h4"
                            component="h1"
                            sx={{ flex: 1 }}
                        >
                            {_('Stories')}
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<Add />}
                            onClick={() => navigate('new')}
                        >
                            {_('New story')}
                        </Button>
                    </Stack>
                    <StoryList store={store} />
                </Container>
            )}
            <PasswordDialog
                open={store.prompt !== null}
                storyName={store.prompt?.name ?? ''}
                onSubmit={(password) => store.submitPassword(password)}
                onCancel={() => store.cancelPassword()}
                onRequestReset={(email) => store.requestPasswordReset(email)}
            />
            {resetLink && (
                <ResetPasswordDialog
                    storyName={storyName(resetLink.storyId)}
                    onSubmit={(password) => resetPassword(resetLink, password)}
                    onClose={closeReset}
                />
            )}
        </>
    );
});
