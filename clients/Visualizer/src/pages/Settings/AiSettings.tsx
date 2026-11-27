import { Switch, Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';
import type { AiStore } from '../../ai/AiStore';
import { HintText } from '../../components/feedback/HintText';
import { LoadingState } from '../../components/feedback/LoadingState';
import { FormField } from '../../components/form/FormField';
import { FormFields } from '../../components/form/FormFields';

type TProps = {
    aiFeature: boolean | undefined;
    ai: Pick<AiStore, 'available' | 'credits'>;
};

export const AiSettings = observer(({ aiFeature, ai }: TProps) => {
    if (aiFeature === undefined) return <LoadingState />;

    return (
        <FormFields>
            <FormField
                label={_('AI features')}
                helperText={_('Turned on and off by the server administrator.')}
            >
                <Switch
                    checked={aiFeature}
                    disabled
                    slotProps={{ input: { 'aria-label': _('AI features') } }}
                    data-field="aiFeature"
                />
            </FormField>
            <FormField
                label={_('Available credits')}
                helperText={_('Spent by the AI agent and by image generation.')}
            >
                {ai.available ? (
                    <Typography variant="h6" data-field="aiCredits">
                        {ai.credits}
                    </Typography>
                ) : (
                    <HintText>
                        {_('AI is not available on this server.')}
                    </HintText>
                )}
            </FormField>
        </FormFields>
    );
});
