import { useEffect } from 'react';
import { IconButton, styled, Tooltip } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { observer } from 'mobx-react-lite';
import type { AiStore } from '../ai/AiStore';
import { aiStore } from '../context';
import {
    storyInfo as defaultStoryInfo,
    type StoryInfoStore,
} from './storyInfoStore';

type TProps = {
    store?: AiStore;
    info?: Pick<StoryInfoStore, 'info'>;
};

export const AiButton = observer(
    ({ store = aiStore, info = defaultStoryInfo }: TProps) => {
        const story = info.info;
        const aiFeature = story?.access === 'edit' && story.aiFeature;

        useEffect(
            () => (aiFeature ? store.start() : undefined),
            [aiFeature, store]
        );

        if (!aiFeature || !store.available) return null;

        return (
            <Tooltip
                title={
                    store.open
                        ? _('Close the AI agent')
                        : _('Open the AI agent')
                }
            >
                <SButton
                    color="inherit"
                    size="small"
                    aria-label={_('AI agent')}
                    aria-pressed={store.open}
                    onClick={store.toggle}
                    $active={store.open}
                >
                    <SmartToyIcon />
                </SButton>
            </Tooltip>
        );
    }
);

const SButton = styled(IconButton, {
    shouldForwardProp: (prop) => prop !== '$active',
})<{ $active: boolean }>`
    flex-shrink: 0;
    background-color: ${({ $active }) =>
        $active ? 'rgba(255, 255, 255, 0.2)' : 'transparent'};
`;
