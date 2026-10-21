import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    styled,
    Typography,
} from '@mui/material';
import { observer } from 'mobx-react-lite';
import { STORY_LANDING_IMAGE_ID } from '@story/protocol';
import { spacingCss } from '@story/ui';
import { STORY_ID, type TVisualizerApi } from '../api';
import { ImageInput } from '../components/inputs/ImageInput';
import { FormLabel } from '../components/inputs/form/FormLabel';
import type { StoryInfoStore } from './storyInfoStore';

type TProps = {
    store: StoryInfoStore;
    onClose: () => void;
    api?: TVisualizerApi;
};

export const StorySettingsDialog = observer(
    ({ store, onClose, api }: TProps) => (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{_('Story settings')}</DialogTitle>
            <DialogContent dividers>
                <SFields>
                    <FormLabel
                        label={_('Name')}
                        helperText={_('Change it on the stories page.')}
                    >
                        <Typography data-field="story-name">
                            {store.info?.name ?? STORY_ID}
                        </Typography>
                    </FormLabel>
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
                            onChange={() => void store.reload()}
                        />
                    </FormLabel>
                </SFields>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{_('Close')}</Button>
            </DialogActions>
        </Dialog>
    )
);

const SFields = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(2)};
`;
