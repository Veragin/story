import React from 'react';
import { 
    TextField, 
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
import { Add, Remove, Inventory, HelpOutline } from '@mui/icons-material';
import { TItemId } from 'types/TItem';
import { ItemResolver } from 'code/Visualizer/Graphs/EventPassagesGraph/store/ItemResolver';
import { SCompactColumn, SCompactRow } from '../../styles';

type ItemCost = { id: TItemId; amount: number };

type Props = {
    value: ItemCost[];
    onChange: (items: ItemCost[]) => void;
};

export const ItemsCostInput = ({ value, onChange }: Props) => {
    const availableItems = ItemResolver.getItemsForSelect();

    const handleItemChange = (index: number, field: keyof ItemCost, newValue: any) => {
        const newItems = [...value];
        newItems[index] = { ...newItems[index], [field]: newValue };
        onChange(newItems);
    };

    const addItem = () => {
        onChange([...value, { id: 'gold' as TItemId, amount: 1 }]);
    };

    const removeItem = (index: number) => {
        onChange(value.filter((_, i) => i !== index));
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Inventory fontSize="small" />
                    Required Items
                </Typography>
                <Tooltip title="Items consumed when used" arrow>
                    <HelpOutline sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                </Tooltip>
            </Box>

            <SCompactColumn>
                {value.map((item, index) => (
                    <SCompactRow key={index}>
                        <FormControl size="small" sx={{ flex: 1 }}>
                            <InputLabel>Item</InputLabel>
                            <Select
                                value={item.id}
                                onChange={(e) => handleItemChange(index, 'id', e.target.value)}
                                label="Item"
                            >
                                {availableItems.map((availableItem) => (
                                    <MenuItem key={availableItem.value} value={availableItem.value}>
                                        <Box>
                                            <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                                                {availableItem.label}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                {ItemResolver.formatItemType(availableItem.type)}
                                            </Typography>
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        
                        <TextField
                            label="Amount"
                            type="number"
                            value={item.amount}
                            onChange={(e) => handleItemChange(index, 'amount', parseInt(e.target.value) || 1)}
                            size="small"
                            sx={{ width: 70 }}
                            slotProps={{ htmlInput: { min: 1 } }}
                        />
                        
                        <IconButton
                            onClick={() => removeItem(index)}
                            size="small"
                            color="error"
                        >
                            <Remove fontSize="small" />
                        </IconButton>
                    </SCompactRow>
                ))}

                <Button
                    variant="outlined"
                    onClick={addItem}
                    startIcon={<Add fontSize="small" />}
                    size="small"
                    sx={{ alignSelf: 'flex-start', fontSize: '0.8rem', py: 0.5 }}
                >
                    Add Item
                </Button>
            </SCompactColumn>
        </Box>
    );
};