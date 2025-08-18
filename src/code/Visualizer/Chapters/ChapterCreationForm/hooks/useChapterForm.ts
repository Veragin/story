import { useState, useCallback, useEffect } from 'react';
import { showToast } from 'code/GlobalWrapper';
import { ChapterResolver } from 'code/Visualizer/GUIComponents/Graphs/ChapterPassagesGraph/store/ChapterResolcer';
import { TChapterFormData, TTimeRange, DEFAULT_FORM_DATA, validateTimeRange, validateChildren } from '../types';
import { Agent } from 'code/Visualizer/stores/Agent';
import { TChapterData } from 'code/Visualizer/stores/ nodeServerTypes';

export const useChapterForm = (agent: Agent) => {
    const [formData, setFormData] = useState<TChapterFormData>(DEFAULT_FORM_DATA);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [chapterId, setChapterId] = useState('');
    const [existingChapterIds, setExistingChapterIds] = useState<string[]>([]);

    // Fetch existing chapter IDs on mount
    useEffect(() => {
        const fetchChapterIds = async () => {
            try {
                const ids = ChapterResolver.getAvailableChapterIds();
                setExistingChapterIds(ids);
            } catch (error) {
                console.error('Failed to fetch existing chapter IDs:', error);
                showToast(_('Failed to load existing chapters'), { variant: 'error' });
            }
        };

        fetchChapterIds();
    }, []);

    const handleInputChange = useCallback((field: keyof TChapterFormData, value: any) => {
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
        if (!chapterId.trim()) {
            showToast(_('Chapter ID is required'), { variant: 'error' });
            return false;
        }
        
        if (existingChapterIds.includes(chapterId.trim())) {
            showToast(_('Chapter ID already exists'), { variant: 'error' });
            return false;
        }

        if (!formData.title.trim()) {
            showToast(_('Chapter title is required'), { variant: 'error' });
            return false;
        }

        if (!formData.location.trim()) {
            showToast(_('Location is required'), { variant: 'error' });
            return false;
        }

        // Validate time range - now required
        const timeRangeError = validateTimeRange(formData.timeRange);
        if (timeRangeError) {
            showToast(timeRangeError, { variant: 'error' });
            return false;
        }

        const childrenError = validateChildren(formData.children, existingChapterIds);
        if (childrenError) {
            showToast(childrenError, { variant: 'error' });
            return false;
        }

        return true;
    };

    const handleSubmit = async (onChapterCreated?: (chapterId: string) => void) => {
        if (!validateForm()) return;

        setIsSubmitting(true);
        try {
            // Create properly typed TChapterData object
            const chapterData: TChapterData = {
                title: formData.title.trim(),
                description: formData.description.trim(),
                location: formData.location.trim(),
                timeRange: {
                    start: formData.timeRange.start || '',
                    end: formData.timeRange.end || ''
                },
                children: formData.children
            };

            console.log('Creating chapter with data:', { chapterId: chapterId.trim(), chapterData });

            await agent.updateChapter(chapterId.trim(), chapterData);
            
            // Reset form
            handleReset();

            // Refresh the existing chapter IDs
            const updatedIds = ChapterResolver.getAvailableChapterIds();
            setExistingChapterIds(updatedIds);

            onChapterCreated?.(chapterId.trim());
            showToast(_('Chapter created successfully'), { variant: 'success' });
        } catch (error) {
            console.error('Failed to create chapter:', error);
            showToast(_('Failed to create chapter'), { variant: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReset = () => {
        setFormData(DEFAULT_FORM_DATA);
        setChapterId('');
    };

    return {
        // State
        formData,
        chapterId,
        existingChapterIds,
        isSubmitting,
        
        // Setters
        setChapterId,
        
        // Handlers
        handleInputChange,
        handleTimeRangeChange,
        handleSubmit,
        handleReset,
    };
};
