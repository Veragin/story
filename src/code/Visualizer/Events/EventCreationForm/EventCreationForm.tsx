import React from 'react';
import {
    Button,
    Typography,
    Divider,
    Tooltip,
} from '@mui/material';
import { Event } from '@mui/icons-material';
import { Agent } from 'code/Visualizer/stores/Agent';
import { useEventForm } from './hooks/useEventForm';
import { BasicInfoSection } from './components/BasicInfoSection';
import { LocationSection } from './components/LocationSection';
import { TimeRangeSection } from './components/TimeRangeSection';
import { SFormContainer, SHeader, SFormContent, SButtonRow } from './styles';

type Props = {
    onEventCreated?: (eventId: string) => void;
    onCancel?: () => void;
    agent: Agent;
};

export const EventCreationForm = ({ onEventCreated, onCancel, agent }: Props) => {
    const {
        formData,
        eventId,
        existingEventIds,
        isSubmitting,
        setEventId,
        handleInputChange,
        handleTimeRangeChange,
        handleSubmit,
        handleReset,
    } = useEventForm(agent);

    return (
        <SFormContainer>
            <SHeader>
                <Tooltip title="Events are containers for passages and define game timeline" arrow>
                    <Typography variant="h6" component="h2" sx={{ cursor: 'help', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Event fontSize="small" />
                        {_('Create New Event')}
                    </Typography>
                </Tooltip>
            </SHeader>

            <SFormContent>
                <BasicInfoSection
                    eventId={eventId}
                    setEventId={setEventId}
                    formData={formData}
                    handleInputChange={handleInputChange}
                    existingEventIds={existingEventIds}
                />

                <Divider sx={{ my: 2 }} />

                <LocationSection
                    value={formData.location}
                    onChange={(location) => handleInputChange('location', location)}
                />

                <Divider sx={{ my: 2 }} />

                <TimeRangeSection
                    value={formData.timeRange}
                    onChange={handleTimeRangeChange}
                />

                <SButtonRow>
                    <Button
                        variant="outlined"
                        onClick={handleReset}
                        disabled={isSubmitting}
                        size="small"
                        sx={{ fontSize: '0.8rem' }}
                    >
                        {_('Reset')}
                    </Button>
                    {onCancel && (
                        <Button
                            variant="outlined"
                            onClick={onCancel}
                            disabled={isSubmitting}
                            size="small"
                            sx={{ fontSize: '0.8rem' }}
                        >
                            {_('Cancel')}
                        </Button>
                    )}
                    <Button
                        variant="contained"
                        onClick={() => handleSubmit(onEventCreated)}
                        disabled={isSubmitting}
                        color="primary"
                        size="small"
                        sx={{ fontSize: '0.8rem' }}
                    >
                        {isSubmitting ? _('Creating...') : _('Create Event')}
                    </Button>
                </SButtonRow>
            </SFormContent>
        </SFormContainer>
    );
};
