import React, { useRef, useCallback } from 'react';
import {
    TextField,
    Typography,
    Box,
    MenuItem,
    Select,
    InputLabel,
    IconButton,
    InputAdornment,
    Tooltip,
} from '@mui/material';
import { FolderOpen, HelpOutline } from '@mui/icons-material';
import { showToast } from 'code/GlobalWrapper';
import { SFormRow, SFormControl } from '../styles';
import { CharacterResolver } from 'code/Visualizer/Graphs/EventPassagesGraph/store/CharacterResolver';

type Props = {
    passageId: string;
    setPassageId: (id: string) => void;
    formData: {
        title: string;
        image: string;
        character: string;
    };
    handleInputChange: (field: string, value: any) => void;
    existingPassageIds: string[];
};

export const BasicInfoSection = ({ 
    passageId, 
    setPassageId, 
    formData, 
    handleInputChange, 
    existingPassageIds 
}: Props) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const availableCharacters = CharacterResolver.getAllCharacters();

    const handleFileSelect = useCallback(() => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    }, []);

    const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                showToast(_('Please select an image file'), { variant: 'error' });
                return;
            }

            const fileName = file.name;
            handleInputChange('image', fileName);
            showToast(_('Image selected successfully'), { variant: 'success' });
        }
        
        if (event.target) {
            event.target.value = '';
        }
    }, [handleInputChange]);

    const truncateText = (text: string, maxLength: number = 50) => {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    return (
        <Box>
            <Typography variant="h6" gutterBottom sx={{ fontSize: '1rem', fontWeight: 500, mb: 1 }}>
                {_('Basic Information')}
            </Typography>

            <SFormRow>
                <SFormControl fullWidth>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography component="label" variant="body2" sx={{ fontSize: '0.875rem' }}>
                            {_('Passage ID')} *
                        </Typography>
                        <Tooltip title="Enter a unique identifier for this passage" arrow>
                            <HelpOutline sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                        </Tooltip>
                    </Box>
                    <TextField
                        value={passageId}
                        onChange={(e) => setPassageId(e.target.value)}
                        variant="outlined"
                        size="small"
                        required
                        placeholder="unique-passage-id"
                        error={passageId.trim() !== '' && existingPassageIds.includes(passageId.trim())}
                        helperText={
                            passageId.trim() !== '' && existingPassageIds.includes(passageId.trim())
                                ? _('This passage ID already exists')
                                : ''
                        }
                    />
                </SFormControl>
            </SFormRow>

            <SFormRow>
                <SFormControl fullWidth>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography component="label" variant="body2" sx={{ fontSize: '0.875rem' }}>
                            {_('Title')}
                        </Typography>
                        <Tooltip title="Display title for the screen passage" arrow>
                            <HelpOutline sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                        </Tooltip>
                    </Box>
                    <TextField
                        value={formData.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        variant="outlined"
                        size="small"
                        placeholder="Screen passage title"
                    />
                </SFormControl>
            </SFormRow>

            <SFormRow>
                <SFormControl fullWidth>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography component="label" variant="body2" sx={{ fontSize: '0.875rem' }}>
                            {_('Character')} *
                        </Typography>
                        <Tooltip title="Required - Character associated with this screen passage" arrow>
                            <HelpOutline sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                        </Tooltip>
                    </Box>
                    <Select
                        value={formData.character}
                        onChange={(e) => handleInputChange('character', e.target.value)}
                        size="small"
                        required
                        displayEmpty
                    >
                        <MenuItem value="" disabled>
                            <em>{_('Select a character')}</em>
                        </MenuItem>
                        {availableCharacters.map((character) => (
                            <MenuItem key={character.id} value={character.id}>
                                <Box>
                                    <Typography variant="body2" component="span" sx={{ fontSize: '0.875rem' }}>
                                        {character.name}
                                    </Typography>
                                    <Typography 
                                        variant="caption" 
                                        color="text.secondary"
                                        component="span"
                                        sx={{ ml: 1, fontSize: '0.75rem' }}
                                    >
                                        ({character.type === 'main' ? _('Main Character') : _('Side Character')})
                                    </Typography>
                                    {character.description && (
                                        <Typography 
                                            variant="caption" 
                                            color="text.secondary"
                                            component="div"
                                            sx={{ mt: 0.25, fontStyle: 'italic', fontSize: '0.7rem' }}
                                        >
                                            {truncateText(character.description, 50)}
                                        </Typography>
                                    )}
                                </Box>
                            </MenuItem>
                        ))}
                    </Select>
                </SFormControl>
            </SFormRow>

            <SFormRow>
                <SFormControl fullWidth>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography component="label" variant="body2" sx={{ fontSize: '0.875rem' }}>
                            {_('Image Path')}
                        </Typography>
                        <Tooltip title="Optional - Image to display on the screen" arrow>
                            <HelpOutline sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                        </Tooltip>
                    </Box>
                    <TextField
                        value={formData.image}
                        onChange={(e) => handleInputChange('image', e.target.value)}
                        variant="outlined"
                        size="small"
                        placeholder="path/to/image.png or select file"
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        onClick={handleFileSelect}
                                        edge="end"
                                        size="small"
                                    >
                                        <FolderOpen fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        style={{ display: 'none' }}
                    />
                </SFormControl>
            </SFormRow>
        </Box>
    );
};