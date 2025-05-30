import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    styled,
    FormControl,
    TextField,
    Button,
    Paper,
    Typography,
    Box,
    MenuItem,
    Select,
    InputLabel,
    IconButton,
    InputAdornment,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Checkbox,
    FormControlLabel,
    Chip,
    Divider,
    Card,
    CardHeader,
    CardContent,
    Collapse,
    FormGroup,
    Grid,
} from '@mui/material';
import { 
    FolderOpen, 
    ExpandMore, 
    Add, 
    Delete, 
    AddLink,
    Remove,
    ExpandLess,
    AccessTime,
    Inventory,
    Build,
    MonetizationOn,
} from '@mui/icons-material';
import { Column, Row } from 'code/components/Basic';
import { spacingCss } from 'code/components/css';
import { showToast } from 'code/GlobalWrapper';
import { TEventPassageType } from 'types/TPassage';
import { Agent } from '../stores/Agent';
import { PassageResolver } from '../Graphs/EventPassagesGraph/store/PassageResolver';
import { TEventId } from 'types/TIds';
import { TPassageData } from '../stores/ nodeServerTypes';
import { CharacterResolver } from '../Graphs/EventPassagesGraph/store/CharacterResolver';
import { EventResolver } from '../Graphs/EventPassagesGraph/store/EventResolcer';
import { ItemResolver } from '../Graphs/EventPassagesGraph/store/ItemResolver';
import { DeltaTime } from 'time/Time';
import { TItemId } from 'types/TItem';

type TLinkCost =
    | DeltaTime
    | {
        time?: DeltaTime;
        items?: { id: TItemId; amount: number }[];
        tools?: TItemId[];
    };

type TBodyItemLink = {
    text: string;
    passageId: string;
    autoPriority?: number;
    cost?: TLinkCost;
    onFinish?: () => void;
};

type TBodyItem = {
    condition?: boolean;
    redirect?: string;
    text?: string;
    links?: TBodyItemLink[];
};

type Props = {
    onPassageCreated?: (passageId: string) => void;
    onCancel?: () => void;
    agent: Agent;
    eventId: TEventId;
};

export const ScreenPassageCreationForm = ({ onPassageCreated, onCancel, agent, eventId }: Props) => {
    const [formData, setFormData] = useState<{
        title: string;
        image: string;
        character: string;
        body: TBodyItem[];
    }>({
        title: '',
        image: '',
        character: '',
        body: [{ text: '', links: [] }],
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [passageId, setPassageId] = useState('');
    const [existingPassageIds, setExistingPassageIds] = useState<string[]>([]);
    const [availablePassageIds, setAvailablePassageIds] = useState<string[]>([]);
    const [isLoadingPassages, setIsLoadingPassages] = useState(true);
    const [expandedLinks, setExpandedLinks] = useState<{ [key: string]: boolean }>({});
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const availableCharacters = CharacterResolver.getAllCharacters();
    const availableEvents = EventResolver.getAllEvents();
    const availableItems = ItemResolver.getItemsForSelect();
    const availableTools = ItemResolver.getToolsForSelect();

    // Fetch existing passage IDs when component mounts or eventId changes
    useEffect(() => {
        const fetchPassageIds = async () => {
            setIsLoadingPassages(true);
            try {
                const ids = await PassageResolver.getAvailablePassageIds(eventId);
                setExistingPassageIds(ids);
                
                // Get all passage IDs from all events for redirect options
                const allEventIds = EventResolver.getAvailableEventIds();
                const allPassageIds: string[] = [];
                for (const evId of allEventIds) {
                    try {
                        const passageIds = await PassageResolver.getAvailablePassageIds(evId);
                        passageIds.forEach(pId => {
                            allPassageIds.push(`${evId}-${pId}`);
                        });
                    } catch (error) {
                        // Event might not have passages, skip
                    }
                }
                setAvailablePassageIds(allPassageIds);
            } catch (error) {
                console.error('Failed to fetch existing passage IDs:', error);
                showToast(_('Failed to load existing passages'), { variant: 'error' });
            } finally {
                setIsLoadingPassages(false);
            }
        };

        fetchPassageIds();
    }, [eventId]);

    const handleInputChange = useCallback((field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            [field]: value,
        }));
    }, []);

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

    const handleBodyItemChange = useCallback((index: number, field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            body: prev.body.map((item, i) => 
                i === index ? { ...item, [field]: value } : item
            ),
        }));
    }, []);

    const addBodyItem = useCallback(() => {
        setFormData(prev => ({
            ...prev,
            body: [...prev.body, { text: '', links: [] }],
        }));
    }, []);

    const removeBodyItem = useCallback((index: number) => {
        setFormData(prev => ({
            ...prev,
            body: prev.body.filter((_, i) => i !== index),
        }));
    }, []);

    const handleLinkChange = useCallback((bodyIndex: number, linkIndex: number, field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            body: prev.body.map((item, i) => 
                i === bodyIndex ? {
                    ...item,
                    links: item.links?.map((link, li) => 
                        li === linkIndex ? { ...link, [field]: value } : link
                    ) || []
                } : item
            ),
        }));
    }, []);

    const handleLinkCostChange = useCallback((bodyIndex: number, linkIndex: number, costType: string, costData: any) => {
        setFormData(prev => ({
            ...prev,
            body: prev.body.map((item, i) => 
                i === bodyIndex ? {
                    ...item,
                    links: item.links?.map((link, li) => {
                        if (li === linkIndex) {
                            let newCost: TLinkCost | undefined;
                            
                            if (costType === 'none') {
                                newCost = undefined;
                            } else if (costType === 'deltaTime') {
                                newCost = costData;
                            } else if (costType === 'complex') {
                                newCost = {
                                    time: costData.time,
                                    items: costData.items,
                                    tools: costData.tools
                                };
                            }
                            
                            return { ...link, cost: newCost };
                        }
                        return link;
                    }) || []
                } : item
            ),
        }));
    }, []);

    const addLink = useCallback((bodyIndex: number) => {
        setFormData(prev => ({
            ...prev,
            body: prev.body.map((item, i) => 
                i === bodyIndex ? {
                    ...item,
                    links: [...(item.links || []), { text: '', passageId: '', autoPriority: 0 }]
                } : item
            ),
        }));
    }, []);

    const removeLink = useCallback((bodyIndex: number, linkIndex: number) => {
        setFormData(prev => ({
            ...prev,
            body: prev.body.map((item, i) => 
                i === bodyIndex ? {
                    ...item,
                    links: item.links?.filter((_, li) => li !== linkIndex) || []
                } : item
            ),
        }));
    }, []);

    const toggleLinkExpanded = useCallback((linkKey: string) => {
        setExpandedLinks(prev => ({
            ...prev,
            [linkKey]: !prev[linkKey]
        }));
    }, []);

    const getCostType = (cost: TLinkCost | undefined): string => {
        if (!cost) return 'none';
        if (cost instanceof DeltaTime) return 'deltaTime';
        return 'complex';
    };

    const validateForm = (): boolean => {
        if (!passageId.trim()) {
            showToast(_('Passage ID is required'), { variant: 'error' });
            return false;
        }
        
        if (existingPassageIds.includes(passageId.trim())) {
            showToast(_('Passage ID already exists'), { variant: 'error' });
            return false;
        }

        if (!formData.character) {
            showToast(_('Character selection is required'), { variant: 'error' });
            return false;
        }

        return true;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        setIsSubmitting(true);
        try {
            const passageData: any = {
                type: 'screen' as TEventPassageType,
                eventId: eventId,
                characterId: formData.character,
                id: passageId.trim(),
                title: formData.title.trim() || 'Untitled Screen',
                image: formData.image.trim() || '',
                body: formData.body.filter(item => 
                    item.text?.trim() || 
                    item.redirect?.trim() || 
                    (item.links && item.links.length > 0)
                ),
            };

            await agent.addScreenPassage(passageId.trim(), passageData);
            
            // Reset form
            setFormData({
                title: '',
                image: '',
                character: '',
                body: [{ text: '', links: [] }],
            });
            setPassageId('');
            setExpandedLinks({});

            // Refresh the existing passage IDs
            const updatedIds = await PassageResolver.getAvailablePassageIds(eventId);
            setExistingPassageIds(updatedIds);

            onPassageCreated?.(passageId.trim());
            showToast(_('Screen passage created successfully'), { variant: 'success' });
        } catch (error) {
            console.error('Failed to create screen passage:', error);
            showToast(_('Failed to create screen passage'), { variant: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReset = () => {
        setFormData({
            title: '',
            image: '',
            character: '',
            body: [{ text: '', links: [] }],
        });
        setPassageId('');
        setExpandedLinks({});
    };

    const truncateText = (text: string, maxLength: number = 50) => {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    const renderLinkCostSection = (bodyIndex: number, linkIndex: number, link: TBodyItemLink) => {
        const linkKey = `${bodyIndex}-${linkIndex}`;
        const isExpanded = expandedLinks[linkKey];
        const costType = getCostType(link.cost);

        return (
            <SLinkCostContainer>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <MonetizationOn sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="subtitle2">
                        {_('Link Cost')}
                    </Typography>
                    <IconButton
                        onClick={() => toggleLinkExpanded(linkKey)}
                        size="small"
                        sx={{ ml: 'auto' }}
                    >
                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                </Box>

                <Collapse in={isExpanded}>
                    <Column sx={{ gap: 2 }}>
                        <FormControl size="small" fullWidth>
                            <InputLabel>{_('Cost Type')}</InputLabel>
                            <Select
                                value={costType}
                                onChange={(e) => {
                                    const newType = e.target.value;
                                    if (newType === 'none') {
                                        handleLinkCostChange(bodyIndex, linkIndex, 'none', undefined);
                                    } else if (newType === 'deltaTime') {
                                        handleLinkCostChange(bodyIndex, linkIndex, 'deltaTime', DeltaTime.fromString('1h'));
                                    } else if (newType === 'complex') {
                                        handleLinkCostChange(bodyIndex, linkIndex, 'complex', {
                                            time: undefined,
                                            items: [],
                                            tools: []
                                        });
                                    }
                                }}
                                label={_('Cost Type')}
                            >
                                <MenuItem value="none">{_('No Cost')}</MenuItem>
                                <MenuItem value="deltaTime">{_('Time Only')}</MenuItem>
                                <MenuItem value="complex">{_('Complex Cost')}</MenuItem>
                            </Select>
                        </FormControl>

                        {costType === 'deltaTime' && (
                            <TextField
                                label={_('Time Cost')}
                                value={link.cost instanceof DeltaTime ? `${link.cost.hour}h` : '1h'}
                                onChange={(e) => {
                                    try {
                                        const timeStr = e.target.value;
                                        const deltaTime = DeltaTime.fromString(timeStr as any);
                                        handleLinkCostChange(bodyIndex, linkIndex, 'deltaTime', deltaTime);
                                    } catch (error) {
                                        // Invalid format, ignore
                                    }
                                }}
                                size="small"
                                placeholder="1h, 30min, 2d, etc."
                                helperText={_('Format: 1h, 30min, 2d, 1d 2h, etc.')}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <AccessTime />
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        )}

                        {costType === 'complex' && (
                            <SComplexCostContainer>
                                {/* Time Section */}
                                <Card variant="outlined">
                                    <CardHeader
                                        avatar={<AccessTime />}
                                        title={_('Time Cost')}
                                        subheader={_('Optional time requirement')}
                                        sx={{ pb: 1 }}
                                    />
                                    <CardContent sx={{ pt: 0 }}>
                                        <TextField
                                            label={_('Time')}
                                            value={
                                                link.cost && typeof link.cost === 'object' && 'time' in link.cost && link.cost.time
                                                    ? `${link.cost.time.hour}h`
                                                    : ''
                                            }
                                            onChange={(e) => {
                                                try {
                                                    const timeStr = e.target.value;
                                                    const deltaTime = timeStr ? DeltaTime.fromString(timeStr as any) : undefined;
                                                    const currentCost = (link.cost && typeof link.cost === 'object' && 'time' in link.cost) 
                                                        ? link.cost 
                                                        : { time: undefined, items: [], tools: [] };
                                                    
                                                    handleLinkCostChange(bodyIndex, linkIndex, 'complex', {
                                                        ...currentCost,
                                                        time: deltaTime
                                                    });
                                                } catch (error) {
                                                    // Invalid format, ignore
                                                }
                                            }}
                                            size="small"
                                            fullWidth
                                            placeholder="Leave empty for no time cost"
                                        />
                                    </CardContent>
                                </Card>

                                {/* Items Section */}
                                <Card variant="outlined">
                                    <CardHeader
                                        avatar={<Inventory />}
                                        title={_('Required Items')}
                                        subheader={_('Items consumed when using this link')}
                                        sx={{ pb: 1 }}
                                    />
                                    <CardContent sx={{ pt: 0 }}>
                                        <Column sx={{ gap: 2 }}>
                                            {link.cost && typeof link.cost === 'object' && 'items' in link.cost && 
                                             link.cost.items?.map((item, itemIndex) => (
                                                <Row key={itemIndex} sx={{ gap: 1, alignItems: 'center' }}>
                                                    <FormControl size="small" sx={{ minWidth: 200 }}>
                                                        <InputLabel>{_('Item')}</InputLabel>
                                                        <Select
                                                            value={item.id}
                                                            onChange={(e) => {
                                                                const currentCost = link.cost as any;
                                                                const newItems = [...(currentCost.items || [])];
                                                                newItems[itemIndex] = { ...item, id: e.target.value };
                                                                handleLinkCostChange(bodyIndex, linkIndex, 'complex', {
                                                                    ...currentCost,
                                                                    items: newItems
                                                                });
                                                            }}
                                                            label={_('Item')}
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
                                                        label={_('Amount')}
                                                        type="number"
                                                        value={item.amount}
                                                        onChange={(e) => {
                                                            const currentCost = link.cost as any;
                                                            const newItems = [...(currentCost.items || [])];
                                                            newItems[itemIndex] = { ...item, amount: parseInt(e.target.value) || 1 };
                                                            handleLinkCostChange(bodyIndex, linkIndex, 'complex', {
                                                                ...currentCost,
                                                                items: newItems
                                                            });
                                                        }}
                                                        size="small"
                                                        sx={{ width: 100 }}
                                                        inputProps={{ min: 1 }}
                                                    />
                                                    <IconButton
                                                        onClick={() => {
                                                            const currentCost = link.cost as any;
                                                            const newItems = (currentCost.items || []).filter((_: any, i: number) => i !== itemIndex);
                                                            handleLinkCostChange(bodyIndex, linkIndex, 'complex', {
                                                                ...currentCost,
                                                                items: newItems
                                                            });
                                                        }}
                                                        size="small"
                                                        color="error"
                                                    >
                                                        <Remove />
                                                    </IconButton>
                                                </Row>
                                            ))}
                                            <Button
                                                variant="outlined"
                                                onClick={() => {
                                                    const currentCost = (link.cost && typeof link.cost === 'object' && 'items' in link.cost) 
                                                        ? link.cost 
                                                        : { time: undefined, items: [], tools: [] };
                                                    
                                                    handleLinkCostChange(bodyIndex, linkIndex, 'complex', {
                                                        ...currentCost,
                                                        items: [...(currentCost.items || []), { id: 'gold' as TItemId, amount: 1 }]
                                                    });
                                                }}
                                                startIcon={<Add />}
                                                size="small"
                                            >
                                                {_('Add Item')}
                                            </Button>
                                        </Column>
                                    </CardContent>
                                </Card>

                                {/* Tools Section */}
                                <Card variant="outlined">
                                    <CardHeader
                                        avatar={<Build />}
                                        title={_('Required Tools')}
                                        subheader={_('Tools needed (not consumed)')}
                                        sx={{ pb: 1 }}
                                    />
                                    <CardContent sx={{ pt: 0 }}>
                                        <Column sx={{ gap: 2 }}>
                                            {link.cost && typeof link.cost === 'object' && 'tools' in link.cost && 
                                             link.cost.tools?.map((toolId, toolIndex) => (
                                                <Row key={toolIndex} sx={{ gap: 1, alignItems: 'center' }}>
                                                    <FormControl size="small" sx={{ minWidth: 200 }}>
                                                        <InputLabel>{_('Tool')}</InputLabel>
                                                        <Select
                                                            value={toolId}
                                                            onChange={(e) => {
                                                                const currentCost = link.cost as any;
                                                                const newTools = [...(currentCost.tools || [])];
                                                                newTools[toolIndex] = e.target.value;
                                                                handleLinkCostChange(bodyIndex, linkIndex, 'complex', {
                                                                    ...currentCost,
                                                                    tools: newTools
                                                                });
                                                            }}
                                                            label={_('Tool')}
                                                        >
                                                            {availableTools.map((tool) => (
                                                                <MenuItem key={tool.value} value={tool.value}>
                                                                    {tool.label}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    </FormControl>
                                                    <IconButton
                                                        onClick={() => {
                                                            const currentCost = link.cost as any;
                                                            const newTools = (currentCost.tools || []).filter((_: any, i: number) => i !== toolIndex);
                                                            handleLinkCostChange(bodyIndex, linkIndex, 'complex', {
                                                                ...currentCost,
                                                                tools: newTools
                                                            });
                                                        }}
                                                        size="small"
                                                        color="error"
                                                    >
                                                        <Remove />
                                                    </IconButton>
                                                </Row>
                                            ))}
                                            <Button
                                                variant="outlined"
                                                onClick={() => {
                                                    const currentCost = (link.cost && typeof link.cost === 'object' && 'tools' in link.cost) 
                                                        ? link.cost 
                                                        : { time: undefined, items: [], tools: [] };
                                                    
                                                    handleLinkCostChange(bodyIndex, linkIndex, 'complex', {
                                                        ...currentCost,
                                                        tools: [...(currentCost.tools || []), 'bow' as TItemId]
                                                    });
                                                }}
                                                startIcon={<Add />}
                                                size="small"
                                            >
                                                {_('Add Tool')}
                                            </Button>
                                        </Column>
                                    </CardContent>
                                </Card>
                            </SComplexCostContainer>
                        )}
                    </Column>
                </Collapse>
            </SLinkCostContainer>
        );
    };

    return (
        <SFormContainer>
            <SHeader>
                <Typography variant="h6" component="h2">
                    {_('Create New Screen Passage')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {_('Screen passages are interactive screens with choices and links')}
                </Typography>
            </SHeader>

            <SFormContent>
                {/* Basic Information */}
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
                            title={_('Enter a unique identifier for this passage')}
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
                            title={_('Select a character to associate with this passage')}
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
                            title={_('Enter image path or click folder icon to browse files')}
                            helperText={_('Optional - Image to display on the screen. Type path or click folder icon to select file')}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={handleFileSelect}
                                            edge="end"
                                            aria-label={_('Select image file')}
                                            title={_('Select image file')}
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
                            placeholder='path/to/image.png'
                            onChange={handleFileChange}
                            accept="image/*"
                            style={{ display: 'none' }}
                        />
                    </SFormControl>
                </SFormRow>

                <Divider sx={{ my: 3 }} />

                {/* Body Content */}
                <Typography variant="h6" gutterBottom>
                    {_('Passage Content')}
                </Typography>

                {formData.body.map((bodyItem, bodyIndex) => (
                    <SBodyItemContainer key={bodyIndex}>
                        <Accordion defaultExpanded>
                            <AccordionSummary expandIcon={<ExpandMore />}>
                                <Typography variant="subtitle1">
                                    {_('Content Block')} {bodyIndex + 1}
                                </Typography>
                                {formData.body.length > 1 && (
                                    <IconButton
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeBodyItem(bodyIndex);
                                        }}
                                        size="small"
                                        sx={{ ml: 'auto', mr: 1 }}
                                    >
                                        <Delete />
                                    </IconButton>
                                )}
                            </AccordionSummary>
                            <AccordionDetails>
                                <Column sx={{ gap: 2 }}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={bodyItem.condition || false}
                                                onChange={(e) => handleBodyItemChange(bodyIndex, 'condition', e.target.checked)}
                                            />
                                        }
                                        label={_('Has condition')}
                                    />

                                    <TextField
                                        label={_('Text Content')}
                                        value={bodyItem.text || ''}
                                        onChange={(e) => handleBodyItemChange(bodyIndex, 'text', e.target.value)}
                                        variant="outlined"
                                        size="small"
                                        multiline
                                        rows={3}
                                        placeholder="Enter the text content for this screen section"
                                        helperText={_('The text displayed in this content block')}
                                    />

                                    <TextField
                                        label={_('Redirect Passage ID')}
                                        value={bodyItem.redirect || ''}
                                        onChange={(e) => handleBodyItemChange(bodyIndex, 'redirect', e.target.value)}
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
                                        <Row sx={{ alignItems: 'center', mb: 2 }}>
                                            <Typography variant="subtitle2">
                                                {_('Links')}
                                            </Typography>
                                            <IconButton
                                                onClick={() => addLink(bodyIndex)}
                                                size="small"
                                                sx={{ ml: 1 }}
                                            >
                                                <AddLink />
                                            </IconButton>
                                        </Row>

                                        {bodyItem.links?.map((link, linkIndex) => (
                                            <SLinkContainer key={linkIndex}>
                                                <Column sx={{ gap: 2 }}>
                                                    <Row sx={{ gap: 2, alignItems: 'flex-start' }}>
                                                        <TextField
                                                            label={_('Link Text')}
                                                            value={link.text}
                                                            onChange={(e) => handleLinkChange(bodyIndex, linkIndex, 'text', e.target.value)}
                                                            variant="outlined"
                                                            size="small"
                                                            sx={{ flex: 1 }}
                                                            placeholder="Link display text"
                                                        />
                                                        <TextField
                                                            label={_('Target Passage')}
                                                            value={link.passageId}
                                                            onChange={(e) => handleLinkChange(bodyIndex, linkIndex, 'passageId', e.target.value)}
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
                                                            onChange={(e) => handleLinkChange(bodyIndex, linkIndex, 'autoPriority', parseInt(e.target.value) || 0)}
                                                            variant="outlined"
                                                            size="small"
                                                            type="number"
                                                            sx={{ width: 100 }}
                                                        />
                                                        <IconButton
                                                            onClick={() => removeLink(bodyIndex, linkIndex)}
                                                            size="small"
                                                            color="error"
                                                        >
                                                            <Remove />
                                                        </IconButton>
                                                    </Row>
                                                    
                                                    {renderLinkCostSection(bodyIndex, linkIndex, link)}
                                                </Column>
                                            </SLinkContainer>
                                        ))}
                                    </Box>
                                </Column>
                            </AccordionDetails>
                        </Accordion>
                    </SBodyItemContainer>
                ))}

                <Button
                    variant="outlined"
                    onClick={addBodyItem}
                    startIcon={<Add />}
                    sx={{ mt: 2 }}
                >
                    {_('Add Content Block')}
                </Button>

                <SButtonRow>
                    <Button
                        variant="outlined"
                        onClick={handleReset}
                        disabled={isSubmitting}
                    >
                        {_('Reset')}
                    </Button>
                    {onCancel && (
                        <Button
                            variant="outlined"
                            onClick={onCancel}
                            disabled={isSubmitting}
                        >
                            {_('Cancel')}
                        </Button>
                    )}
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={isSubmitting || isLoadingPassages}
                        color="primary"
                    >
                        {isSubmitting ? _('Creating...') : _('Create Screen Passage')}
                    </Button>
                </SButtonRow>
            </SFormContent>
        </SFormContainer>
    );
};

const SFormContainer = styled(Paper)(({ theme }) => `
    padding: ${spacingCss(3)};
    max-width: 1000px;
    margin: 0 auto;
    background-color: ${theme.palette.background.paper};
    color: ${theme.palette.text.primary};
`);

const SHeader = styled(Box)(({ theme }) => `
    margin-bottom: ${spacingCss(3)};
    border-bottom: 1px solid ${theme.palette.divider};
    padding-bottom: ${spacingCss(2)};
`);

const SFormContent = styled(Column)`
    gap: ${spacingCss(3)};
`;

const SFormRow = styled(Row)`
    width: 100%;
`;

const SButtonRow = styled(Row)`
    gap: ${spacingCss(2)};
    justify-content: flex-end;
    margin-top: ${spacingCss(4)};
`;

const SFormControl = styled(FormControl)(({ theme }) => `
    min-width: 200px;

    & .MuiOutlinedInput-notchedOutline {
        border-color: ${theme.palette.divider};
    }

    & .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline {
        border-color: ${theme.palette.text.primary};
    }

    & .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline {
        border-color: ${theme.palette.primary.main};
    }

    & .MuiInputLabel-root {
        color: ${theme.palette.text.secondary};

        &.Mui-focused {
            color: ${theme.palette.primary.main};
        }
    }
`);

const SBodyItemContainer = styled(Box)(({ theme }) => `
    border: 1px solid ${theme.palette.divider};
    border-radius: 8px;
    margin-bottom: ${spacingCss(2)};
    background-color: ${theme.palette.background.default};
`);

const SLinkContainer = styled(Box)(({ theme }) => `
    padding: ${spacingCss(2)};
    border: 1px solid ${theme.palette.divider};
    border-radius: 8px;
    margin-bottom: ${spacingCss(1)};
    background-color: ${theme.palette.background.paper};
`);

const SLinkCostContainer = styled(Box)(({ theme }) => `
    padding: ${spacingCss(2)};
    border: 1px solid ${theme.palette.divider};
    border-radius: 6px;
    background-color: ${theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50]};
    margin-top: ${spacingCss(1)};
`);

const SComplexCostContainer = styled(Column)`
    gap: ${spacingCss(2)};
`;