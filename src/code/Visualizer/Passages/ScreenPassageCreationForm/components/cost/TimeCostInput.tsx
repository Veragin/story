import React, { useState, useEffect } from 'react';
import { TextField, InputAdornment, Box, Typography } from '@mui/material';
import { AccessTime } from '@mui/icons-material';
import { DeltaTime } from 'time/Time';
import { TTimeInput, parseTimeInput, formatTimeInput, timeInputToDeltaTime } from '../types';
import { SCompactRow } from '../styles';

type Props = {
    value?: DeltaTime;
    onChange: (deltaTime?: DeltaTime) => void;
    label?: string;
    placeholder?: string;
};

export const TimeCostInput = ({ value, onChange, label = 'Time Cost', placeholder }: Props) => {
    const [timeInput, setTimeInput] = useState<TTimeInput>({ hours: 0, minutes: 0 });

    // Convert DeltaTime to hours and minutes on value change
    useEffect(() => {
        if (value) {
            const totalMinutes = Math.round(value.min);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            setTimeInput({ hours, minutes });
        } else {
            setTimeInput({ hours: 0, minutes: 0 });
        }
    }, [value]);

    const handleHoursChange = (hours: number) => {
        const newTimeInput = { ...timeInput, hours: Math.max(0, hours) };
        setTimeInput(newTimeInput);
        onChange(timeInputToDeltaTime(newTimeInput));
    };

    const handleMinutesChange = (minutes: number) => {
        const newTimeInput = { ...timeInput, minutes: Math.max(0, Math.min(59, minutes)) };
        setTimeInput(newTimeInput);
        onChange(timeInputToDeltaTime(newTimeInput));
    };

    const handleTextInputChange = (text: string) => {
        try {
            const parsed = parseTimeInput(text);
            setTimeInput(parsed);
            onChange(timeInputToDeltaTime(parsed));
        } catch (error) {
            // Invalid format, ignore
        }
    };

    return (
        <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccessTime fontSize="small" />
                {label}
            </Typography>
            
            <SCompactRow>
                <TextField
                    label="Hours"
                    type="number"
                    value={timeInput.hours || ''}
                    onChange={(e) => handleHoursChange(parseInt(e.target.value) || 0)}
                    size="small"
                    sx={{ width: 80 }}
                    inputProps={{ min: 0, max: 99 }}
                />
                
                <TextField
                    label="Minutes"
                    type="number"
                    value={timeInput.minutes || ''}
                    onChange={(e) => handleMinutesChange(parseInt(e.target.value) || 0)}
                    size="small"
                    sx={{ width: 80 }}
                    inputProps={{ min: 0, max: 59 }}
                />
                
                <Typography variant="body2" color="text.secondary" sx={{ mx: 1 }}>
                    or
                </Typography>
                
                <TextField
                    label="Text Input"
                    value={formatTimeInput(timeInput)}
                    onChange={(e) => handleTextInputChange(e.target.value)}
                    size="small"
                    sx={{ flex: 1, minWidth: 120 }}
                    placeholder={placeholder || "1h 30min, 2d, etc."}
                    helperText="Format: 1h, 30min, 2d, 1h 30min"
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <AccessTime fontSize="small" />
                            </InputAdornment>
                        ),
                    }}
                />
            </SCompactRow>
            
            {(timeInput.hours > 0 || timeInput.minutes > 0) && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    Total: {timeInput.hours > 0 && `${timeInput.hours}h`} {timeInput.minutes > 0 && `${timeInput.minutes}min`}
                </Typography>
            )}
        </Box>
    );
};