import React from 'react';
import { 
    Button, 
    IconButton, 
    Typography, 
    Box, 
    FormControl, 
    InputLabel, 
    Select, 
    MenuItem 
} from '@mui/material';
import { Add, Remove, Build } from '@mui/icons-material';
import { TItemId } from 'types/TItem';
import { ItemResolver } from '../../Graphs/EventPassagesGraph/store/ItemResolver';
import { SCompactRow, SCompactColumn } from '../styles';

type Props = {
    value: TItemId[];
    onChange: (tools: TItemId[]) => void;
};

export const ToolsCostInput = ({ value, onChange }: Props) => {
    const availableTools = ItemResolver.getToolsForSelect();

    const handleToolChange = (index: number, newValue: TItemId) => {
        const newTools = [...value];
        newTools[index] = newValue;
        onChange(newTools);
    };

    const addTool = () => {
        onChange([...value, 'bow' as TItemId]);
    };

    const removeTool = (index: number) => {
        onChange(value.filter((_, i) => i !== index));
    };

    return (
        <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Build fontSize="small" />
                Required Tools
                <Typography variant="caption" color="text.secondary" component="span">
                    (needed but not consumed)
                </Typography>
            </Typography>

            <SCompactColumn>
                {value.map((toolId, index) => (
                    <SCompactRow key={index}>
                        <FormControl size="small" sx={{ minWidth: 200 }}>
                            <InputLabel>Tool</InputLabel>
                            <Select
                                value={toolId}
                                onChange={(e) => handleToolChange(index, e.target.value as TItemId)}
                                label="Tool"
                            >
                                {availableTools.map((tool) => (
                                    <MenuItem key={tool.value} value={tool.value}>
                                        {tool.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        
                        <IconButton
                            onClick={() => removeTool(index)}
                            size="small"
                            color="error"
                        >
                            <Remove />
                        </IconButton>
                    </SCompactRow>
                ))}

                <Button
                    variant="outlined"
                    onClick={addTool}
                    startIcon={<Add />}
                    size="small"
                    sx={{ alignSelf: 'flex-start' }}
                >
                    Add Tool
                </Button>
            </SCompactColumn>
        </Box>
    );
};