import { TLocationId } from 'types/TLocation';
import { Agent } from 'code/Visualizer/stores/Agent';

export type TTimeRange = {
    start: string;
    end: string;
};

export type TEventFormData = {
    title: string;
    description: string;
    location: string;
    timeRange: TTimeRange;
};

export type TFormProps = {
    onEventCreated?: (eventId: string) => void;
    onCancel?: () => void;
    agent: Agent;
};

export const DEFAULT_TIME_RANGE: TTimeRange = {
    start: '',
    end: ''
};

export const DEFAULT_FORM_DATA: TEventFormData = {
    title: '',
    description: '',
    location: '',
    timeRange: DEFAULT_TIME_RANGE
};

// Helper functions for time formatting
export const formatDateTime = (dateTime: string): string => {
    if (!dateTime) return '';
    
    try {
        const date = new Date(dateTime);
        return date.toLocaleString();
    } catch {
        return dateTime;
    }
};

export const parseDateTime = (dateTimeString: string): string => {
    if (!dateTimeString) return '';
    
    try {
        const date = new Date(dateTimeString);
        return date.toISOString();
    } catch {
        return dateTimeString;
    }
};

export const validateTimeRange = (timeRange: TTimeRange): string | null => {
    if (!timeRange.start || !timeRange.end) {
        return null; // Allow empty time ranges
    }
    
    const startDate = new Date(timeRange.start);
    const endDate = new Date(timeRange.end);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return _('Invalid date format');
    }
    
    if (startDate >= endDate) {
        return _('End time must be after start time');
    }
    
    return null;
};

export const calculateDuration = (timeRange: TTimeRange): string => {
    if (!timeRange.start || !timeRange.end) {
        return '';
    }
    
    try {
        const startDate = new Date(timeRange.start);
        const endDate = new Date(timeRange.end);
        const diffMs = endDate.getTime() - startDate.getTime();
        
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        const parts: string[] = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        
        return parts.length > 0 ? parts.join(' ') : '< 1m';
    } catch {
        return '';
    }
};
