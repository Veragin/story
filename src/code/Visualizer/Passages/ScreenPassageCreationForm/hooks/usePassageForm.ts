import { useState, useCallback, useEffect } from 'react';
import { showToast } from 'code/GlobalWrapper';
import { PassageResolver } from '../Graphs/EventPassagesGraph/store/PassageResolver';
import { EventResolver } from '../Graphs/EventPassagesGraph/store/EventResolcer';
import { TEventPassageType } from 'types/TPassage';
import { TEventId } from 'types/TIds';
import { TPassageFormData, TBodyItem, TBodyItemLink, TLinkCost } from './types';

export const usePassageForm = (eventId: TEventId, agent: any) => {
    const [formData, setFormData] = useState<TPassageFormData>({
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

    // Fetch existing passage IDs when eventId changes
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

    const handleLinkCostChange = useCallback((bodyIndex: number, linkIndex: number, newCost: TLinkCost | undefined) => {
        setFormData(prev => ({
            ...prev,
            body: prev.body.map((item, i) => 
                i === bodyIndex ? {
                    ...item,
                    links: item.links?.map((link, li) => 
                        li === linkIndex ? { ...link, cost: newCost } : link
                    ) || []
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

    const handleSubmit = async (onPassageCreated?: (passageId: string) => void) => {
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
            handleReset();

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

    return {
        // State
        formData,
        passageId,
        existingPassageIds,
        availablePassageIds,
        isSubmitting,
        isLoadingPassages,
        expandedLinks,
        
        // Setters
        setPassageId,
        
        // Handlers
        handleInputChange,
        handleBodyItemChange,
        addBodyItem,
        removeBodyItem,
        handleLinkChange,
        handleLinkCostChange,
        addLink,
        removeLink,
        toggleLinkExpanded,
        handleSubmit,
        handleReset,
    };
};