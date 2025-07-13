import React, { useState, useEffect } from 'react';
import { TextField, InputAdornment, Box, Typography, Tooltip } from '@mui/material';
import { AccessTime, HelpOutline } from '@mui/icons-material';
import { DeltaTime } from 'time/Time';
import { formatTimeInput, parseTimeInput, timeInputToDeltaTime, TTimeInput } from '../../types';

type Props = {
    value?: DeltaTime;
    onChange: (deltaTime?: DeltaTime) => void;
    label?: string;
    placeholder?: string;
};

export const TimeCostInput = ({ value, onChange, label = 'Time Cost', placeholder }: Props) => {
    const [textValue, setTextValue] = useState<string>('');
    const [timeInput, setTimeInput] = useState<TTimeInput>({ days: 0, hours: 0, minutes: 0 });
    const [hasError, setHasError] = useState<boolean>(false);

    // Convert DeltaTime to formatted string when value changes from outside
    useEffect(() => {
        if (value) {
            const totalMinutes = Math.round(value.min);
            const days = Math.floor(totalMinutes / (24 * 60));
            const remainingMinutes = totalMinutes % (24 * 60);
            const hours = Math.floor(remainingMinutes / 60);
            const minutes = remainingMinutes % 60;
            const newTimeInput = { days, hours, minutes };
            setTimeInput(newTimeInput);
            setTextValue(formatTimeInput(newTimeInput));
            setHasError(false);
        } else {
            setTimeInput({ days: 0, hours: 0, minutes: 0 });
            setTextValue('');
            setHasError(false);
        }
    }, [value]);

    const handleTextInputChange = (text: string) => {
        setTextValue(text);
        
        // If empty, clear the value
        if (!text.trim()) {
            setTimeInput({ days: 0, hours: 0, minutes: 0 });
            onChange(undefined);
            setHasError(false);
            return;
        }

        // Custom parsing logic that's more forgiving for typing
        const parseCustomTimeInput = (input: string): { parsed: TTimeInput; isComplete: boolean } => {
            const text = input.toLowerCase().trim();
            let days = 0, hours = 0, minutes = 0;
            let hasValidInput = false;

            // Match patterns like "1d", "2h", "30min", "1d 2h", "1d 2h 30min", etc.
            const dayMatch = text.match(/(\d+)d/);
            const hourMatch = text.match(/(\d+)h/);
            const minuteMatch = text.match(/(\d+)(?:min|m(?:\s|$))/);

            if (dayMatch) {
                days = parseInt(dayMatch[1]) || 0;
                hasValidInput = true;
            }
            if (hourMatch) {
                hours = parseInt(hourMatch[1]) || 0;
                hasValidInput = true;
            }
            if (minuteMatch) {
                minutes = parseInt(minuteMatch[1]) || 0;
                hasValidInput = true;
            }

            // Validate ranges
            hours = Math.max(0, Math.min(23, hours));
            minutes = Math.max(0, Math.min(59, minutes));
            days = Math.max(0, days);

            // Check if this looks like an incomplete input
            const hasIncompleteNumbers = /\d+$/.test(text) && !/(d|h|min|m)$/.test(text);
            const isComplete = hasValidInput && !hasIncompleteNumbers;

            return { parsed: { days, hours, minutes }, isComplete };
        };

        const result = parseCustomTimeInput(text);
        
        // Only update the actual value if we have a complete, valid input
        if (result.isComplete && (result.parsed.days > 0 || result.parsed.hours > 0 || result.parsed.minutes > 0)) {
            setTimeInput(result.parsed);
            onChange(timeInputToDeltaTime(result.parsed));
            setHasError(false);
        } else if (result.isComplete && result.parsed.days === 0 && result.parsed.hours === 0 && result.parsed.minutes === 0) {
            // If complete but all zeros, clear
            setTimeInput({ days: 0, hours: 0, minutes: 0 });
            onChange(undefined);
            setHasError(false);
        } else {
            // Incomplete input - don't change the value, but check for obvious errors
            const hasAnyValidFormat = /\d+[dhm]/.test(text) || /\d+\s*(min|minutes)/.test(text);
            const hasOnlyValidChars = /^[\d\s]+$|^[\d\sdhmint\s]+$/.test(text);
            
            if (text.length > 0 && (!hasOnlyValidChars || (text.length > 3 && !hasAnyValidFormat))) {
                setHasError(true);
            } else {
                setHasError(false);
            }
        }
    };

    const formatDisplayText = () => {
        if (hasError && textValue) {
            return `Invalid format: ${textValue}`;
        }
        const parts: string[] = [];
        if (timeInput.days > 0) parts.push(`${timeInput.days}d`);
        if (timeInput.hours > 0) parts.push(`${timeInput.hours}h`);
        if (timeInput.minutes > 0) parts.push(`${timeInput.minutes}min`);
        return parts.length > 0 ? parts.join(' ') : 'No time cost';
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AccessTime fontSize="small" />
                    {label}
                </Typography>
                <Tooltip title="Format: 1d, 2h, 30min, 1d 2h 30min" arrow>
                    <HelpOutline sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                </Tooltip>
            </Box>
            
            <TextField
                label="Time Input"
                value={textValue}
                onChange={(e) => handleTextInputChange(e.target.value)}
                size="small"
                fullWidth
                placeholder={placeholder || "1d 2h 30min"}
                error={hasError}
                slotProps={{
                    input: {
                        startAdornment: (
                            <InputAdornment position="start">
                                <AccessTime fontSize="small" />
                            </InputAdornment>
                        ),
                    },
                }}
            />
            
            <Typography 
                variant="caption" 
                color={hasError ? "error" : "text.secondary"} 
                sx={{ mt: 0.5, display: 'block', fontSize: '0.7rem' }}
            >
                {formatDisplayText()}
            </Typography>
        </Box>
    );
};