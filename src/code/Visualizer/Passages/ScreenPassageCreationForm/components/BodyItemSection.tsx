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
    Button,
} from '@mui/material';
import { ExpandMore, Delete, AddLink } from '@mui/icons-material';
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
    return (
        <SBodyItemContainer>
            <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="subtitle1">
                        {_('Content Block')} {bodyIndex + 1}
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
                            <Delete />
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
                                />
                            }
                            label={_('Has condition')}
                        />

                        <TextField
                            label={_('Text Content')}
                            value={bodyItem.text || ''}
                            onChange={(e) => onBodyItemChange(bodyIndex, 'text', e.target.value)}
                            variant="outlined"
                            size="small"
                            multiline
                            rows={2}
                            placeholder="Enter the text content for this screen section"
                            helperText={_('The text displayed in this content block')}
                        />

                        <TextField
                            label={_('Redirect Passage ID')}
                            value={bodyItem.redirect || ''}
                            onChange={(e) => onBodyItemChange(bodyIndex, 'redirect', e.target.value)}
                            variant="outlined"
                            size="small"
                            select
                            placeholder="Select passage to redirect to"
                            helperText={_('Optional - Automatically redirect to another passage')}
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

                        {/* Links Section */}
                        <Box>
                            <Row sx={{ alignItems: 'center', mb: 1 }}>
                                <Typography variant="subtitle2">
                                    {_('Links')}
                                </Typography>
                                <IconButton
                                    onClick={() => onAddLink(bodyIndex)}
                                    size="small"
                                    sx={{ ml: 1 }}
                                >
                                    <AddLink />
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