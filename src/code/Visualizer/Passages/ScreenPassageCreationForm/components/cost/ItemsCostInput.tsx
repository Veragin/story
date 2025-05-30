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
    MenuItem 
} from '@mui/material';
import { Add, Remove, Inventory } from '@mui/icons-material';
import { TItemId } from 'types/TItem';
import { ItemResolver } from '../../Graphs/EventPassagesGraph/store/ItemResolver';
import { SCompactRow, SCompactColumn } from '../styles';

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
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Inventory fontSize="small" />
                Required Items
                <Typography variant="caption" color="text.secondary" component="span">
                    (consumed when used)
                </Typography>
            </Typography>

            <SCompactColumn>
                {value.map((item, index) => (
                    <SCompactRow key={index}>
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel>Item</InputLabel>
                            <Select
                                value={item.id}
                                onChange={(e) => handleItemChange(index, 'id', e.target.value)}
                                label="Item"
                            >
                                {availableItems.map((availableItem) => (
                                    <MenuItem key={availableItem.value} value={availableItem.value}>
                                        <Box>
                                            <Typography variant="body2">
                                                {availableItem.label}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
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
                            sx={{ width: 80 }}
                            inputProps={{ min: 1 }}
                        />
                        
                        <IconButton
                            onClick={() => removeItem(index)}
                            size="small"
                            color="error"
                        >
                            <Remove />
                        </IconButton>
                    </SCompactRow>
                ))}

                <Button
                    variant="outlined"
                    onClick={addItem}
                    startIcon={<Add />}
                    size="small"
                    sx={{ alignSelf: 'flex-start' }}
                >
                    Add Item
                </Button>
            </SCompactColumn>
        </Box>
    );
};