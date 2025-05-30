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
} from '@mui/material';
import { FolderOpen } from '@mui/icons-material';
import { showToast } from 'code/GlobalWrapper';
import { CharacterResolver } from '../../Graphs/EventPassagesGraph/store/CharacterResolver';
import { SFormRow, SFormControl } from '../styles';

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
            <Typography variant="h6" gutterBottom>
                {_('Basic Information')}
            </Typography>

            <SFormRow>
                <SFormControl fullWidth>
                    <TextField
                        label={_('Passage ID')}
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
                                : _('Enter a unique identifier for this passage')
                        }
                    />
                </SFormControl>
            </SFormRow>

            <SFormRow>
                <SFormControl fullWidth>
                    <TextField
                        label={_('Title')}
                        value={formData.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        variant="outlined"
                        size="small"
                        placeholder="Screen passage title"
                        helperText={_('Display title for the screen passage')}
                    />
                </SFormControl>
            </SFormRow>

            <SFormRow>
                <SFormControl fullWidth>
                    <InputLabel id="character-select-label">{_('Character')}</InputLabel>
                    <Select
                        labelId="character-select-label"
                        value={formData.character}
                        onChange={(e) => handleInputChange('character', e.target.value)}
                        label={_('Character')}
                        size="small"
                        required
                    >
                        {availableCharacters.map((character) => (
                            <MenuItem key={character.id} value={character.id}>
                                <Box>
                                    <Typography variant="body2" component="span">
                                        {character.name}
                                    </Typography>
                                    <Typography 
                                        variant="caption" 
                                        color="text.secondary"
                                        component="span"
                                        sx={{ ml: 1 }}
                                    >
                                        ({character.type === 'main' ? _('Main Character') : _('Side Character')})
                                    </Typography>
                                    {character.description && (
                                        <Typography 
                                            variant="caption" 
                                            color="text.secondary"
                                            component="div"
                                            sx={{ mt: 0.5, fontStyle: 'italic' }}
                                        >
                                            {truncateText(character.description, 50)}
                                        </Typography>
                                    )}
                                </Box>
                            </MenuItem>
                        ))}
                    </Select>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.5 }}>
                        {_('Required - Character associated with this screen passage')}
                    </Typography>
                </SFormControl>
            </SFormRow>

            <SFormRow>
                <SFormControl fullWidth>
                    <TextField
                        label={_('Image Path')}
                        value={formData.image}
                        onChange={(e) => handleInputChange('image', e.target.value)}
                        variant="outlined"
                        size="small"
                        placeholder="path/to/image.png or select file"
                        helperText={_('Optional - Image to display on the screen')}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        onClick={handleFileSelect}
                                        edge="end"
                                        size="small"
                                    >
                                        <FolderOpen />
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