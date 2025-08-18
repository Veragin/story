import React from 'react';
import {
    TextField,
    Typography,
    Box,
    MenuItem,
    Select,
    Button,
    IconButton,
    Tooltip,
    Paper,
} from '@mui/material';
import { FamilyRestroom, HelpOutline, Add, Delete } from '@mui/icons-material';
import { SFormRow, SFormControl } from '../styles';
import { TChildChapter } from '../types';

type Props = {
    value: TChildChapter[];
    onChange: (children: TChildChapter[]) => void;
    existingChapterIds: string[];
};

export const ChildrenSection = ({ value, onChange, existingChapterIds }: Props) => {
    const handleAddChild = () => {
        const newChild: TChildChapter = {
            condition: '',
            chapterId: ''
        };
        onChange([...value, newChild]);
    };

    const handleRemoveChild = (index: number) => {
        const newChildren = value.filter((_, i) => i !== index);
        onChange(newChildren);
    };

    const handleChildChange = (index: number, field: keyof TChildChapter, newValue: string) => {
        const newChildren = [...value];
        newChildren[index] = {
            ...newChildren[index],
            [field]: newValue
        };
        onChange(newChildren);
    };

    return (
        <Box>
            <Typography variant="h6" gutterBottom sx={{ fontSize: '1rem', fontWeight: 500, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <FamilyRestroom fontSize="small" />
                {_('Child Chapters')}
            </Typography>

            <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography component="label" variant="body2" sx={{ fontSize: '0.875rem' }}>
                        {_('Conditional Child Chapters')}
                    </Typography>
                    <Tooltip title="Optional - Define chapters that can be triggered based on conditions" arrow>
                        <HelpOutline sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                    </Tooltip>
                </Box>

                {value.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', fontStyle: 'italic', mb: 2 }}>
                        {_('No child chapters defined')}
                    </Typography>
                ) : (
                    <Box sx={{ mb: 2 }}>
                        {value.map((child, index) => (
                            <Paper
                                key={index}
                                elevation={1}
                                sx={{
                                    p: 1.5,
                                    mb: 1,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 1
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                    <Box sx={{ flex: 1 }}>
                                        <SFormRow>
                                            <SFormControl sx={{ flex: 1 }}>
                                                <Typography component="label" variant="caption" sx={{ fontSize: '0.75rem', mb: 0.5, display: 'block' }}>
                                                    {_('Condition')}
                                                </Typography>
                                                <TextField
                                                    value={child.condition}
                                                    onChange={(e) => handleChildChange(index, 'condition', e.target.value)}
                                                    variant="outlined"
                                                    size="small"
                                                    placeholder="condition expression"
                                                    fullWidth
                                                />
                                            </SFormControl>
                                            
                                            <SFormControl sx={{ flex: 1 }}>
                                                <Typography component="label" variant="caption" sx={{ fontSize: '0.75rem', mb: 0.5, display: 'block' }}>
                                                    {_('Chapter')}
                                                </Typography>
                                                <Select
                                                    value={child.chapterId}
                                                    onChange={(e) => handleChildChange(index, 'chapterId', e.target.value)}
                                                    size="small"
                                                    displayEmpty
                                                    fullWidth
                                                >
                                                    <MenuItem value="" disabled>
                                                        <em>{_('Select an chapter')}</em>
                                                    </MenuItem>
                                                    {existingChapterIds.filter(id => id !== '').map((chapterId) => (
                                                        <MenuItem key={chapterId} value={chapterId}>
                                                            {chapterId}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </SFormControl>
                                        </SFormRow>
                                    </Box>

                                    <IconButton
                                        onClick={() => handleRemoveChild(index)}
                                        size="small"
                                        color="error"
                                        sx={{ mt: 2 }}
                                    >
                                        <Delete fontSize="small" />
                                    </IconButton>
                                </Box>
                            </Paper>
                        ))}
                    </Box>
                )}

                <Button
                    variant="outlined"
                    size="small"
                    onClick={handleAddChild}
                    startIcon={<Add />}
                    sx={{ fontSize: '0.8rem' }}
                >
                    {_('Add Child Chapter')}
                </Button>
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block' }}>
                {_('Child chapters will be conditionally triggered based on the specified conditions')}
            </Typography>
        </Box>
    );
};
