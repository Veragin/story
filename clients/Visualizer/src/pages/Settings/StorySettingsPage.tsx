import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { STORY_LANDING_IMAGE_ID } from '@story/protocol';
import {
    CollapsibleSection,
    showToast,
    StoryFormFields,
    StoryFormPage,
} from '@story/ui';
import { api as defaultApi, auth, type TVisualizerApi } from '../../api';
import { FormField } from '../../components/form/FormField';
import { FormFields } from '../../components/form/FormFields';
import { ConflictAlert } from '../../components/feedback/ConflictAlert';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ImageEditor } from '../../components/editors/ImageEditor';
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
                            <ConflictAlert
                                what={_('story')}
                                onReload={store.reload}
                                onKeepMine={store.keepMine}
                                sx={{ mb: 2 }}
                            />
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
                        <FormFields>
                            <StoryFormFields
                                value={store.value}
                                onChange={store.setValue}
                                errors={store.submitted ? store.errors : {}}
                                mode="edit"
                                disabled={store.saving}
                            />
                            <FormField
                                label={_('Landing image')}
                                helperText={_(
                                    'Shown on the start screen of the player. An upload is written right away.'
                                )}
                            >
                                <ImageEditor
                                    owner="story"
                                    id={STORY_LANDING_IMAGE_ID}
                                    api={api}
                                    ariaLabel={_('Landing image')}
                                    onImageChange={() => void storyInfo.reload()}
                                />
                            </FormField>
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
                        </FormFields>
                    ) : (
                        !store.error && <LoadingState />
                    )}
                </StoryFormPage>
            </Box>
        );
    }
);
