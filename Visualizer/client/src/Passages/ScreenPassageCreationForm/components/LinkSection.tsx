import React from 'react';
import {
    TextField,
    IconButton,
    Typography,
    Box,
    MenuItem,
    Collapse,
} from '@mui/material';
import { Remove, ExpandMore, ExpandLess, MonetizationOn } from '@mui/icons-material';
import { TBodyItemLink, TLinkCost } from '../types';
import { TimeCostInput } from './cost/TimeCostInput';
import { ItemsCostInput } from './cost/ItemsCostInput';
import { ToolsCostInput } from './cost/ToolsCostInput';
import { SLinkContainer, SCompactRow, SCompactColumn, SCostSection } from '../styles';

type Props = {
    link: TBodyItemLink;
    bodyIndex: number;
    linkIndex: number;
    availablePassageIds: string[];
    expandedLinks: { [key: string]: boolean };
    onLinkChange: (bodyIndex: number, linkIndex: number, field: string, value: any) => void;
    onLinkCostChange: (bodyIndex: number, linkIndex: number, newCost: TLinkCost | undefined) => void;
    onRemoveLink: (bodyIndex: number, linkIndex: number) => void;
    onToggleExpanded: (linkKey: string) => void;
};

export const LinkSection = ({
    link,
    bodyIndex,
    linkIndex,
    availablePassageIds,
    expandedLinks,
    onLinkChange,
    onLinkCostChange,
    onRemoveLink,
    onToggleExpanded,
}: Props) => {
    const linkKey = `${bodyIndex}-${linkIndex}`;
    const isExpanded = expandedLinks[linkKey];

    const updateCost = (field: keyof TLinkCost, value: any) => {
        const currentCost = link.cost || { time: undefined, items: [], tools: [] };
        const newCost = { ...currentCost, [field]: value };
        
        // Clean up empty cost
        if (!newCost.time && (!newCost.items || newCost.items.length === 0) && (!newCost.tools || newCost.tools.length === 0)) {
            onLinkCostChange(bodyIndex, linkIndex, undefined);
        } else {
            onLinkCostChange(bodyIndex, linkIndex, newCost);
        }
    };

    const hasCost = link.cost && (
        link.cost.time || 
        (link.cost.items && link.cost.items.length > 0) || 
        (link.cost.tools && link.cost.tools.length > 0)
    );

    return (
        <SLinkContainer>
            <SCompactColumn>
                <SCompactRow>
                    <TextField
                        label={_('Link Text')}
                        value={link.text}
                        onChange={(e) => onLinkChange(bodyIndex, linkIndex, 'text', e.target.value)}
                        variant="outlined"
                        size="small"
                        sx={{ flex: 1 }}
                        placeholder="Link display text"
                    />
                    <TextField
                        label={_('Target Passage')}
                        value={link.passageId}
                        onChange={(e) => onLinkChange(bodyIndex, linkIndex, 'passageId', e.target.value)}
                        variant="outlined"
                        size="small"
                        select
                        sx={{ flex: 1 }}
                    >
                        {availablePassageIds.map((passageId) => (
                            <MenuItem key={passageId} value={passageId}>
                                {passageId}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        label={_('Priority')}
                        value={link.autoPriority || 0}
                        onChange={(e) => onLinkChange(bodyIndex, linkIndex, 'autoPriority', parseInt(e.target.value) || 0)}
                        variant="outlined"
                        size="small"
                        type="number"
                        sx={{ width: 70 }}
                    />
                    <IconButton
                        onClick={() => onRemoveLink(bodyIndex, linkIndex)}
                        size="small"
                        color="error"
                    >
                        <Remove />
                    </IconButton>
                </SCompactRow>

                {/* Cost Section */}
                <SCostSection>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <MonetizationOn sx={{ mr: 1, color: 'text.secondary' }} fontSize="small" />
                        <Typography variant="subtitle2">
                            {_('Link Cost')}
                        </Typography>
                        {hasCost && (
                            <Typography variant="caption" color="primary" sx={{ ml: 1, fontSize: '0.7rem' }}>
                                (configured)
                            </Typography>
                        )}
                        <IconButton
                            onClick={() => onToggleExpanded(linkKey)}
                            size="small"
                            sx={{ ml: 'auto' }}
                        >
                            {isExpanded ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                    </Box>

                    <Collapse in={isExpanded}>
                        <SCompactColumn>
                            <TimeCostInput
                                value={link.cost?.time}
                                onChange={(deltaTime) => updateCost('time', deltaTime)}
                                label="Time Required"
                            />

                            <ItemsCostInput
                                value={link.cost?.items || []}
                                onChange={(items) => updateCost('items', items)}
                            />

                            <ToolsCostInput
                                value={link.cost?.tools || []}
                                onChange={(tools) => updateCost('tools', tools)}
                            />
                        </SCompactColumn>
                    </Collapse>
                </SCostSection>
            </SCompactColumn>
        </SLinkContainer>
    );
};