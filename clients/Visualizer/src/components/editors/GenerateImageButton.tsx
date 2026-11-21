import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { observer } from 'mobx-react-lite';
import type { AiStore } from '../../ai/AiStore';
import type { StoryInfoStore } from '../../shell/storyInfoStore';
import { TooltipIconButton } from '../buttons/TooltipIconButton';

export type TImageGenerationAi = Pick<
    AiStore,
    'imageGeneration' | 'enabled' | 'credits' | 'setCredits'
>;

type TProps = {
    ai: TImageGenerationAi;
    info: Pick<StoryInfoStore, 'info'>;
    busy: boolean;
    disabled?: boolean;
    onClick: () => void;
};

export const GenerateImageButton = observer(
    ({ ai, info, busy, disabled, onClick }: TProps) => {
        if (!ai.imageGeneration || !ai.enabled || info.info?.access !== 'edit')
            return null;
        const noCredits = ai.credits <= 0;
        return (
            <TooltipIconButton
                title={
                    noCredits
                        ? _('No AI credits left')
                        : _(
                              'Generate image from the description (unsaved changes included)'
                          )
                }
                icon={AutoAwesomeIcon}
                busy={busy}
                disabled={disabled || noCredits}
                data-action="generate-image"
                onClick={onClick}
            />
        );
    }
);
