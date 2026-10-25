import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { STORY_LANDING_IMAGE_ID } from '@story/protocol';
import {
    CollapsibleSection,
    showToast,
    StoryFormFields,
    StoryFormPage,
} from '@story/ui';
import { api as defaultApi, auth, type TVisualizerApi } from '../../api';
import { FormLabel } from '../../components/inputs/form/FormLabel';
import { ImageInput } from '../../components/inputs/ImageInput';
import { gitStore } from '../../context';
import { GitSettingsForm } from '../../git/GitSettingsForm';
import type { GitStore } from '../../git/GitStore';
import { router, type TSettingsSection } from '../../shell';
import {
    storyInfo as defaultStoryInfo,
    type StoryInfoStore,
} from '../../shell/storyInfoStore';
import { StorySettingsStore } from './StorySettingsStore';

type TProps = {
    section?: TSettingsSection;
    api?: TVisualizerApi;
    git?: GitStore;
    storyInfo?: StoryInfoStore;
};

export const StorySettingsPage = observer(
    ({
        section,
        api = defaultApi,
        git = gitStore,
        storyInfo = defaultStoryInfo,
    }: TProps) => {
        const [store] = useState(
            () => new StorySettingsStore({ api, auth, storyInfo, git })
        );

        useEffect(() => void store.load(), [store]);
        useEffect(() => git.start(), [git]);

        const save = async () => {
            if (await store.save()) {
                showToast(_('Story settings saved'), { variant: 'success' });
            }
        };

        const toggleGit = (expanded: boolean) =>
            router.navigate(
                expanded
                    ? { page: 'settings', section: 'git' }
                    : { page: 'settings' },
                { replace: true }
            );

        return (
            <Box
                sx={{
                    height: '100%',
                    overflow: 'auto',
                    bgcolor: 'background.default',
                }}
            >
                <StoryFormPage
                    title={_('Story settings')}
                    notice={
                        store.conflict && (
                            <Alert
                                severity="warning"
                                sx={{ mb: 2 }}
                                action={
                                    <>
                                        <Button
                                            color="inherit"
                                            size="small"
                                            onClick={store.reload}
                                        >
                                            {_('Reload')}
                                        </Button>
                                        <Button
                                            color="inherit"
                                            size="small"
                                            onClick={store.keepMine}
                                        >
                                            {_('Keep mine')}
                                        </Button>
                                    </>
                                }
                            >
                                {_(
                                    'Someone else changed this story meanwhile.'
                                )}
                            </Alert>
                        )
                    }
                    error={store.error}
                    saving={store.saving}
                    submitLabel={_('Save')}
                    savingLabel={_('Saving…')}
                    submitBlocked={store.submitBlocked}
                    submitAction="save-story-settings"
                    onSubmit={() => void save()}
                    onClose={router.leaveSettings}
                >
                    {store.value ? (
                        <Stack gap={3}>
                            <StoryFormFields
                                value={store.value}
                                onChange={store.setValue}
                                errors={store.submitted ? store.errors : {}}
                                mode="edit"
                                disabled={store.saving}
                            />
                            <FormLabel
                                label={_('Landing image')}
                                helperText={_(
                                    'Shown on the start screen of the player. An upload is written right away.'
                                )}
                            >
                                <ImageInput
                                    owner="story"
                                    id={STORY_LANDING_IMAGE_ID}
                                    api={api}
                                    onChange={() => void storyInfo.reload()}
                                />
                            </FormLabel>
                            {git.available && (
                                <CollapsibleSection
                                    title={_('Git repository')}
                                    summary={
                                        git.config?.remoteUrl ??
                                        _('Not connected')
                                    }
                                    expanded={section === 'git'}
                                    onExpandedChange={toggleGit}
                                >
                                    <GitSettingsForm
                                        key={git.config?.version ?? 'none'}
                                        store={git}
                                    />
                                </CollapsibleSection>
                            )}
                        </Stack>
                    ) : (
                        !store.error && <CircularProgress />
                    )}
                </StoryFormPage>
            </Box>
        );
    }
);
