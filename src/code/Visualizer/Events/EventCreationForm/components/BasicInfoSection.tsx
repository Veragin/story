import React from 'react';
import {
    TextField,
    Typography,
    Box,
    Tooltip,
} from '@mui/material';
import { HelpOutline } from '@mui/icons-material';
import { SFormRow, SFormControl } from '../styles';
import { TEventFormData } from '../types';

type Props = {
    eventId: string;
    setEventId: (id: string) => void;
    formData: {
        title: string;
        description: string;
    };
    handleInputChange: (field: keyof TEventFormData, value: any) => void;
    existingEventIds: string[];
};

export const BasicInfoSection = ({ 
    eventId, 
    setEventId, 
    formData, 
    handleInputChange, 
    existingEventIds 
}: Props) => {
    return (
        <Box>
            <Typography variant="h6" gutterBottom sx={{ fontSize: '1rem', fontWeight: 500, mb: 1 }}>
                {_('Basic Information')}
            </Typography>

            <SFormRow>
                <SFormControl fullWidth>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography component="label" variant="body2" sx={{ fontSize: '0.875rem' }}>
                            {_('Event ID')} *
                        </Typography>
                        <Tooltip title="Enter a unique identifier for this event" arrow>
                            <HelpOutline sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                        </Tooltip>
                    </Box>
                    <TextField
                        value={eventId}
                        onChange={(e) => setEventId(e.target.value)}
                        variant="outlined"
                        size="small"
                        required
                        placeholder="unique-event-id"
                        error={eventId.trim() !== '' && existingEventIds.includes(eventId.trim())}
                        helperText={
                            eventId.trim() !== '' && existingEventIds.includes(eventId.trim())
                                ? _('This event ID already exists')
                                : ''
                        }
                    />
                </SFormControl>
            </SFormRow>

            <SFormRow>
                <SFormControl fullWidth>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography component="label" variant="body2" sx={{ fontSize: '0.875rem' }}>
                            {_('Title')} *
                        </Typography>
                        <Tooltip title="Display title for the event" arrow>
                            <HelpOutline sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                        </Tooltip>
                    </Box>
                    <TextField
                        value={formData.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        variant="outlined"
                        size="small"
                        required
                        placeholder="Event title"
                    />
                </SFormControl>
            </SFormRow>

            <SFormRow>
                <SFormControl fullWidth>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography component="label" variant="body2" sx={{ fontSize: '0.875rem' }}>
                            {_('Description')}
                        </Typography>
                        <Tooltip title="Detailed description of the event" arrow>
                            <HelpOutline sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                        </Tooltip>
                    </Box>
                    <TextField
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        variant="outlined"
                        size="small"
                        multiline
                        rows={3}
                        placeholder="Describe what happens in this event"
                    />
                </SFormControl>
            </SFormRow>
        </Box>
    );
};