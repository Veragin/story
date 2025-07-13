import { useState, useCallback, useEffect } from 'react';
import { showToast } from 'code/GlobalWrapper';
import { EventResolver } from 'code/Visualizer/Graphs/EventPassagesGraph/store/EventResolcer';
import { TEventFormData, TTimeRange, DEFAULT_FORM_DATA, validateTimeRange } from '../types';
import { Agent } from 'code/Visualizer/stores/Agent';
import { TEventData } from 'code/Visualizer/stores/ nodeServerTypes';

export const useEventForm = (agent: Agent) => {
    const [formData, setFormData] = useState<TEventFormData>(DEFAULT_FORM_DATA);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [eventId, setEventId] = useState('');
    const [existingEventIds, setExistingEventIds] = useState<string[]>([]);

    // Fetch existing event IDs on mount
    useEffect(() => {
        const fetchEventIds = async () => {
            try {
                const ids = EventResolver.getAvailableEventIds();
                setExistingEventIds(ids);
            } catch (error) {
                console.error('Failed to fetch existing event IDs:', error);
                showToast(_('Failed to load existing events'), { variant: 'error' });
            }
        };

        fetchEventIds();
    }, []);

    const handleInputChange = useCallback((field: keyof TEventFormData, value: any) => {
        setFormData(prev => ({
            ...prev,
            [field]: value,
        }));
    }, []);

    const handleTimeRangeChange = useCallback((timeRange: TTimeRange) => {
        setFormData(prev => ({
            ...prev,
            timeRange,
        }));
    }, []);

    const validateForm = (): boolean => {
        if (!eventId.trim()) {
            showToast(_('Event ID is required'), { variant: 'error' });
            return false;
        }
        
        if (existingEventIds.includes(eventId.trim())) {
            showToast(_('Event ID already exists'), { variant: 'error' });
            return false;
        }

        if (!formData.title.trim()) {
            showToast(_('Event title is required'), { variant: 'error' });
            return false;
        }

        if (!formData.location.trim()) {
            showToast(_('Location is required'), { variant: 'error' });
            return false;
        }

        // Validate time range if provided
        const timeRangeError = validateTimeRange(formData.timeRange);
        if (timeRangeError) {
            showToast(timeRangeError, { variant: 'error' });
            return false;
        }

        return true;
    };

    const handleSubmit = async (onEventCreated?: (eventId: string) => void) => {
        if (!validateForm()) return;

        setIsSubmitting(true);
        try {
            // Create properly typed TEventData object
            const eventData: TEventData = {
                title: formData.title.trim(),
                description: formData.description.trim(),
                location: formData.location.trim(),
                timeRange: {
                    start: formData.timeRange.start || '',
                    end: formData.timeRange.end || ''
                }
            };

            await agent.addEvent(eventId.trim(), eventData);
            
            // Reset form
            handleReset();

            // Refresh the existing event IDs
            const updatedIds = EventResolver.getAvailableEventIds();
            setExistingEventIds(updatedIds);

            onEventCreated?.(eventId.trim());
            showToast(_('Event created successfully'), { variant: 'success' });
        } catch (error) {
            console.error('Failed to create event:', error);
            showToast(_('Failed to create event'), { variant: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReset = () => {
        setFormData(DEFAULT_FORM_DATA);
        setEventId('');
    };

    return {
        // State
        formData,
        eventId,
        existingEventIds,
        isSubmitting,
        
        // Setters
        setEventId,
        
        // Handlers
        handleInputChange,
        handleTimeRangeChange,
        handleSubmit,
        handleReset,
    };
};
