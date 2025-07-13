import React from 'react';
import {
    Typography,
    Box,
    MenuItem,
    Select,
    Tooltip,
} from '@mui/material';
import { LocationOn, HelpOutline } from '@mui/icons-material';
import { SFormRow, SFormControl } from '../styles';
import { LocationResolver } from 'code/Visualizer/Graphs/EventPassagesGraph/store/LocationResolver';

type Props = {
    value: string;
    onChange: (location: string) => void;
};

export const LocationSection = ({ value, onChange }: Props) => {
    const availableLocations = LocationResolver.getAllLocations();

    const truncateText = (text: string, maxLength: number = 60) => {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    return (
        <Box>
            <Typography variant="h6" gutterBottom sx={{ fontSize: '1rem', fontWeight: 500, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocationOn fontSize="small" />
                {_('Location')}
            </Typography>

            <SFormRow>
                <SFormControl fullWidth>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography component="label" variant="body2" sx={{ fontSize: '0.875rem' }}>
                            {_('Event Location')} *
                        </Typography>
                        <Tooltip title="Required - Location where this event takes place" arrow>
                            <HelpOutline sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                        </Tooltip>
                    </Box>
                    <Select
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        size="small"
                        required
                        displayEmpty
                    >
                        <MenuItem value="" disabled>
                            <em>{_('Select a location')}</em>
                        </MenuItem>
                        {availableLocations.map((location) => (
                            <MenuItem key={location.id} value={location.id}>
                                <Box>
                                    <Typography variant="body2" component="span" sx={{ fontSize: '0.875rem' }}>
                                        {location.name}
                                    </Typography>
                                    <Typography 
                                        variant="caption" 
                                        color="text.secondary"
                                        component="span"
                                        sx={{ ml: 1, fontSize: '0.75rem' }}
                                    >
                                        ({_('Location')})
                                    </Typography>
                                    {location.description && (
                                        <Typography 
                                            variant="caption" 
                                            color="text.secondary"
                                            component="div"
                                            sx={{ mt: 0.25, fontStyle: 'italic', fontSize: '0.7rem' }}
                                        >
                                            {truncateText(location.description, 60)}
                                        </Typography>
                                    )}
                                </Box>
                            </MenuItem>
                        ))}
                    </Select>
                </SFormControl>
            </SFormRow>
        </Box>
    );
};