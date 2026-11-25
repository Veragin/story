import { Button, styled } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { STORY_LANDING_IMAGE_ID } from '@story/protocol';
import { showToast } from '@story/ui';
import type { TVisualizerApi } from '../../api';
import { ConflictAlert } from '../../components/feedback/ConflictAlert';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ImageEditor } from '../../components/editors/ImageEditor';
import { FormField } from '../../components/form/FormField';
import { FormFields } from '../../components/form/FormFields';
import type { StoryInfoStore } from '../../shell/storyInfoStore';
import { StorySettingsFields } from './StorySettingsFields';
import type { StorySettingsStore } from './StorySettingsStore';

type TProps = {
    store: StorySettingsStore;
    api: TVisualizerApi;
    storyInfo: Pick<StoryInfoStore, 'reload'>;
};

export const GeneralSettings = observer(({ store, api, storyInfo }: TProps) => {
    const save = async () => {
        if (await store.save()) {
            showToast(_('Story settings saved'), { variant: 'success' });
        }
    };

    if (!store.value) return store.error ? null : <LoadingState />;

    return (
        <FormFields>
            {store.conflict && (
                <ConflictAlert
                    what={_('story')}
                    onReload={store.reload}
                    onKeepMine={store.keepMine}
                />
            )}
            <StorySettingsFields
                value={store.value}
                onChange={store.setValue}
                errors={store.submitted ? store.errors : {}}
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
            <SActions>
                <Button
                    variant="contained"
                    onClick={() => void save()}
                    disabled={store.saving || store.submitBlocked}
                    data-action="save-story-settings"
                >
                    {store.saving ? _('Saving…') : _('Save')}
                </Button>
            </SActions>
        </FormFields>
    );
});

const SActions = styled('div')`
    display: flex;
    justify-content: flex-end;
`;
