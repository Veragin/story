import React from 'react';
import {
    TextField,
    Typography,
    Box,
    MenuItem,
    IconButton,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Checkbox,
    FormControlLabel,
    Tooltip,
} from '@mui/material';
import { ExpandMore, Delete, AddLink, HelpOutline } from '@mui/icons-material';
import { TBodyItem, TLinkCost } from '../types';
import { LinkSection } from './LinkSection';
import { SBodyItemContainer, SCompactColumn } from '../styles';
import { Column, Row } from 'code/components/Basic';

type Props = {
    bodyItem: TBodyItem;
    bodyIndex: number;
    bodyCount: number;
    availablePassageIds: string[];
    expandedLinks: { [key: string]: boolean };
    onBodyItemChange: (index: number, field: string, value: any) => void;
    onRemoveBodyItem: (index: number) => void;
    onLinkChange: (bodyIndex: number, linkIndex: number, field: string, value: any) => void;
    onLinkCostChange: (bodyIndex: number, linkIndex: number, newCost: TLinkCost | undefined) => void;
    onAddLink: (bodyIndex: number) => void;
    onRemoveLink: (bodyIndex: number, linkIndex: number) => void;
    onToggleLinkExpanded: (linkKey: string) => void;
};

export const BodyItemSection = ({
    bodyItem,
    bodyIndex,
    bodyCount,
    availablePassageIds,
    expandedLinks,
    onBodyItemChange,
    onRemoveBodyItem,
    onLinkChange,
    onLinkCostChange,
    onAddLink,
    onRemoveLink,
    onToggleLinkExpanded,
}: Props) => {
    const getContentTitle = () => {
        if (bodyItem.text && bodyItem.text.trim()) {
            // Get first line of text
            const firstLine = bodyItem.text.split('\n')[0];
            // Truncate if too long (around 50 characters, but break at word boundary)
            if (firstLine.length > 50) {
                const truncated = firstLine.substring(0, 47);
                const lastSpace = truncated.lastIndexOf(' ');
                return (lastSpace > 30 ? truncated.substring(0, lastSpace) : truncated) + '...';
            }
            return firstLine;
        }
        
        if (bodyItem.redirect && bodyItem.redirect.trim()) {
            return `→ ${bodyItem.redirect}`;
        }
        
        if (bodyItem.links && bodyItem.links.length > 0) {
            return `${bodyItem.links.length} link${bodyItem.links.length > 1 ? 's' : ''}`;
        }
        
        return _('Empty Content Block');
    };

    return (
        <SBodyItemContainer>
            <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMore fontSize="small" />}>
                    <Typography variant="subtitle1" sx={{ flex: 1 }}>
                        {getContentTitle()}
                    </Typography>
                    {bodyCount > 1 && (
                        <IconButton
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemoveBodyItem(bodyIndex);
                            }}
                            size="small"
                            sx={{ ml: 'auto', mr: 1 }}
                        >
                            <Delete fontSize="small" />
                        </IconButton>
                    )}
                </AccordionSummary>
                <AccordionDetails>
                    <SCompactColumn>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={bodyItem.condition || false}
                                    onChange={(e) => onBodyItemChange(bodyIndex, 'condition', e.target.checked)}
                                    size="small"
                                />
                            }
                            label={
                                <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                                    {_('Has condition')}
                                </Typography>
                            }
                        />

                        <Box sx={{ mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Typography component="label" variant="body2" sx={{ fontSize: '0.875rem' }}>
                                    {_('Text Content')}
                                </Typography>
                                <Tooltip title="The text displayed in this content block" arrow>
                                    <HelpOutline sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                                </Tooltip>
                            </Box>
                            <TextField
                                value={bodyItem.text || ''}
                                onChange={(e) => onBodyItemChange(bodyIndex, 'text', e.target.value)}
                                variant="outlined"
                                size="small"
                                multiline
                                rows={2}
                                placeholder="Enter the text content for this screen section"
                                fullWidth
                            />
                        </Box>

                        <Box sx={{ mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Typography component="label" variant="body2" sx={{ fontSize: '0.875rem' }}>
                                    {_('Redirect Passage ID')}
                                </Typography>
                                <Tooltip title="Optional - Automatically redirect to another passage" arrow>
                                    <HelpOutline sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                                </Tooltip>
                            </Box>
                            <TextField
                                value={bodyItem.redirect || ''}
                                onChange={(e) => onBodyItemChange(bodyIndex, 'redirect', e.target.value)}
                                variant="outlined"
                                size="small"
                                select
                                placeholder="Select passage to redirect to"
                                fullWidth
                            >
                                <MenuItem value="">
                                    <em>{_('No redirect')}</em>
                                </MenuItem>
                                {availablePassageIds.map((passageId) => (
                                    <MenuItem key={passageId} value={passageId}>
                                        {passageId}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Box>

                        {/* Links Section */}
                        <Box>
                            <Row sx={{ alignItems: 'center', mb: 0.75 }}>
                                <Typography variant="subtitle2" sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
                                    {_('Links')}
                                </Typography>
                                <IconButton
                                    onClick={() => onAddLink(bodyIndex)}
                                    size="small"
                                    sx={{ ml: 1 }}
                                >
                                    <AddLink fontSize="small" />
                                </IconButton>
                            </Row>

                            {bodyItem.links?.map((link, linkIndex) => (
                                <LinkSection
                                    key={linkIndex}
                                    link={link}
                                    bodyIndex={bodyIndex}
                                    linkIndex={linkIndex}
                                    availablePassageIds={availablePassageIds}
                                    expandedLinks={expandedLinks}
                                    onLinkChange={onLinkChange}
                                    onLinkCostChange={onLinkCostChange}
                                    onRemoveLink={onRemoveLink}
                                    onToggleExpanded={onToggleLinkExpanded}
                                />
                            ))}
                        </Box>
                    </SCompactColumn>
                </AccordionDetails>
            </Accordion>
        </SBodyItemContainer>
    );
};