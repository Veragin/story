import React from 'react';
import {
    TextField,
    Typography,
    Box,
    Tooltip,
} from '@mui/material';
import { Schedule, HelpOutline, AccessTime } from '@mui/icons-material';
import { SFormRow, STimeRangeContainer, STimeInputGroup, SDurationDisplay } from '../styles';
import { TTimeRange, calculateDuration, validateTimeRange } from '../types';

type Props = {
    value: TTimeRange;
    onChange: (timeRange: TTimeRange) => void;
};

export const TimeRangeSection = ({ value, onChange }: Props) => {
    const handleStartChange = (start: string) => {
        onChange({ ...value, start });
    };

    const handleEndChange = (end: string) => {
        onChange({ ...value, end });
    };

    const timeRangeError = validateTimeRange(value);
    const duration = calculateDuration(value);

    return (
        <Box>
            <Typography variant="h6" gutterBottom sx={{ fontSize: '1rem', fontWeight: 500, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Schedule fontSize="small" />
                {_('Time Range')}
            </Typography>

            <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography component="label" variant="body2" sx={{ fontSize: '0.875rem' }}>
                        {_('Chapter Duration')} *
                    </Typography>
                    <Tooltip title="Required - Define when this chapter occurs in the game timeline" arrow>
                        <HelpOutline sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                    </Tooltip>
                </Box>

                <STimeRangeContainer>
                    <STimeInputGroup>
                        <TextField
                            label={_('Start Time')}
                            type="datetime-local"
                            value={value.start}
                            onChange={(e) => handleStartChange(e.target.value)}
                            variant="outlined"
                            size="small"
                            fullWidth
                            required
                            error={!value.start && timeRangeError !== null}
                            slotProps={{
                                inputLabel: { shrink: true },
                            }}
                        />
                    </STimeInputGroup>

                    <STimeInputGroup>
                        <TextField
                            label={_('End Time')}
                            type="datetime-local"
                            value={value.end}
                            onChange={(e) => handleEndChange(e.target.value)}
                            variant="outlined"
                            size="small"
                            fullWidth
                            required
                            error={!!timeRangeError}
                            helperText={timeRangeError}
                            slotProps={{
                                inputLabel: { shrink: true },
                            }}
                        />
                    </STimeInputGroup>

                    {duration && (
                        <SDurationDisplay>
                            <Typography variant="caption" component="div">
                                {_('Duration')}
                            </Typography>
                            <Typography variant="body2" className="duration-value">
                                <AccessTime fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                                {duration}
                            </Typography>
                        </SDurationDisplay>
                    )}
                </STimeRangeContainer>
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block' }}>
                {_('Both start and end times are required for creating chapters')}
            </Typography>
        </Box>
    );
};
