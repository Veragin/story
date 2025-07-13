import React from 'react';
import { 
    Button, 
    IconButton, 
    Typography, 
    Box, 
    FormControl, 
    InputLabel, 
    Select, 
    MenuItem,
    Tooltip
} from '@mui/material';
import { Add, Remove, Build, HelpOutline } from '@mui/icons-material';
import { TItemId } from 'types/TItem';
import { ItemResolver } from 'code/Visualizer/Graphs/EventPassagesGraph/store/ItemResolver';
import { SCompactColumn, SCompactRow } from '../../styles';

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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Build fontSize="small" />
                    Required Tools
                </Typography>
                <Tooltip title="Tools needed but not consumed" arrow>
                    <HelpOutline sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                </Tooltip>
            </Box>

            <SCompactColumn>
                {value.map((toolId, index) => (
                    <SCompactRow key={index}>
                        <FormControl size="small" sx={{ flex: 1 }}>
                            <InputLabel>Tool</InputLabel>
                            <Select
                                value={toolId}
                                onChange={(e) => handleToolChange(index, e.target.value as TItemId)}
                                label="Tool"
                            >
                                {availableTools.map((tool) => (
                                    <MenuItem key={tool.value} value={tool.value}>
                                        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                                            {tool.label}
                                        </Typography>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        
                        <IconButton
                            onClick={() => removeTool(index)}
                            size="small"
                            color="error"
                        >
                            <Remove fontSize="small" />
                        </IconButton>
                    </SCompactRow>
                ))}

                <Button
                    variant="outlined"
                    onClick={addTool}
                    startIcon={<Add fontSize="small" />}
                    size="small"
                    sx={{ alignSelf: 'flex-start', fontSize: '0.8rem', py: 0.5 }}
                >
                    Add Tool
                </Button>
            </SCompactColumn>
        </Box>
    );
};