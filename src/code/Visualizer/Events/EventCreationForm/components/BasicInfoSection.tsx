import React from 'react';
import {
    TextField,
    Typography,
    Box,
    Tooltip,
} from '@mui/material';
import { HelpOutline } from '@mui/icons-material';
import { SFormRow, SFormControl } from '../styles';
import { TChapterFormData } from '../types';

type Props = {
    chapterId: string;
    setChapterId: (id: string) => void;
    formData: {
        title: string;
        description: string;
    };
    handleInputChange: (field: keyof TChapterFormData, value: any) => void;
    existingChapterIds: string[];
};

export const BasicInfoSection = ({ 
    chapterId, 
    setChapterId, 
    formData, 
    handleInputChange, 
    existingChapterIds 
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
                            {_('Chapter ID')} *
                        </Typography>
                        <Tooltip title="Enter a unique identifier for this chapter" arrow>
                            <HelpOutline sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                        </Tooltip>
                    </Box>
                    <TextField
                        value={chapterId}
                        onChange={(e) => setChapterId(e.target.value)}
                        variant="outlined"
                        size="small"
                        required
                        placeholder="unique-chapter-id"
                        error={chapterId.trim() !== '' && existingChapterIds.includes(chapterId.trim())}
                        helperText={
                            chapterId.trim() !== '' && existingChapterIds.includes(chapterId.trim())
                                ? _('This chapter ID already exists')
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
                        <Tooltip title="Display title for the chapter" arrow>
                            <HelpOutline sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                        </Tooltip>
                    </Box>
                    <TextField
                        value={formData.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        variant="outlined"
                        size="small"
                        required
                        placeholder="Chapter title"
                    />
                </SFormControl>
            </SFormRow>

            <SFormRow>
                <SFormControl fullWidth>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography component="label" variant="body2" sx={{ fontSize: '0.875rem' }}>
                            {_('Description')}
                        </Typography>
                        <Tooltip title="Detailed description of the chapter" arrow>
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
                        placeholder="Describe what happens in this chapter"
                    />
                </SFormControl>
            </SFormRow>
        </Box>
    );
};