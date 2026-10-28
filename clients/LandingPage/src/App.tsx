import { type ElementType, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Container, Stack, styled, Typography } from '@mui/material';
import { Add } from '@mui/icons-material';
import type { TCreateStoryBody, TSetupGitBody } from '@story/protocol';
import {
    PasswordDialog,
    ResetPasswordDialog,
    showToast,
    spacingCss,
} from '@story/ui';
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
                <SPage maxWidth="md">
                    <SHeader direction="row" alignItems="center" spacing={2}>
                        <STitle variant="h4" component="h1">
                            {_('Stories')}
                        </STitle>
                        <Button
                            variant="contained"
                            startIcon={<Add />}
                            onClick={() => navigate('new')}
                        >
                            {_('New story')}
                        </Button>
                    </SHeader>
                    <StoryList store={store} />
                </SPage>
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

const SPage = styled(Container)`
    padding-top: ${spacingCss(4)};
    padding-bottom: ${spacingCss(4)};
`;

const SHeader = styled(Stack)`
    margin-bottom: ${spacingCss(3)};
`;

const STitle = styled(Typography)<{ component: ElementType }>`
    flex: 1;
`;
