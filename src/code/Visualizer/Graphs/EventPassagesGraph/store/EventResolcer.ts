import { TWorldState } from 'data/TWorldState';
import { Engine } from 'code/Engine/ts/Engine';
import { register } from 'data/register';
import { TEvent } from 'types/TEvent';
import { TEventId } from 'types/TIds';
import { Time } from 'time/Time';

export class EventResolver {
    // Cache is used to avoid repeated expensive operations like dynamic imports or complex transformations
    // In this case, it's mainly useful if events require processing/initialization
    private static eventCache = new Map<TEventId, TEvent<any>>();

    /**
     * Resolves and returns a specific event by ID
     */
    static getEvent<E extends TEventId>(
        eventId: E,
        worldState?: TWorldState,
        engine?: Engine
    ): TEvent<E> {
        // Check cache first
        if (this.eventCache.has(eventId)) {
            return this.eventCache.get(eventId) as TEvent<E>;
        }

        // Check if event exists in register
        if (register.events[eventId]) {
            const event = register.events[eventId] as TEvent<E>;
            this.eventCache.set(eventId, event);
            return event;
        }

        throw new Error(`Event '${eventId}' not found`);
    }

    /**
     * Gets all available events
     */
    static getAllEvents(): TEvent<TEventId>[] {
        return Object.keys(register.events).map(eventId => 
            this.getEvent(eventId as TEventId)
        );
    }

    /**
     * Gets all available event IDs
     */
    static getAvailableEventIds(): TEventId[] {
        return Object.keys(register.events) as TEventId[];
    }

    /**
     * Gets events that have associated passages
     */
    static getEventsWithPassages(): TEvent<TEventId>[] {
        const eventIdsWithPassages = Object.keys(register.passages) as TEventId[];
        return eventIdsWithPassages.map(eventId => this.getEvent(eventId));
    }

    /**
     * Gets events that don't have associated passages
     */
    static getEventsWithoutPassages(): TEvent<TEventId>[] {
        const allEventIds = this.getAvailableEventIds();
        const eventIdsWithPassages = Object.keys(register.passages) as TEventId[];
        const eventIdsWithoutPassages = allEventIds.filter(id => !eventIdsWithPassages.includes(id));
        return eventIdsWithoutPassages.map(eventId => this.getEvent(eventId));
    }

    /**
     * Gets event IDs that have associated passages
     */
    static getEventIdsWithPassages(): TEventId[] {
        return Object.keys(register.passages) as TEventId[];
    }

    /**
     * Checks if an event exists
     */
    static eventExists(eventId: TEventId): boolean {
        return register.events[eventId] !== undefined;
    }

    /**
     * Checks if an event has associated passages
     */
    static eventHasPassages(eventId: TEventId): boolean {
        return register.passages[eventId] !== undefined;
    }

    /**
     * Searches events by title or description (case-insensitive)
     */
    static searchEvents(searchTerm: string): TEvent<TEventId>[] {
        const allEvents = this.getAllEvents();
        const lowerSearchTerm = searchTerm.toLowerCase();
        
        return allEvents.filter(event => 
            event.title.toLowerCase().includes(lowerSearchTerm) ||
            event.description.toLowerCase().includes(lowerSearchTerm) ||
            event.eventId.toLowerCase().includes(lowerSearchTerm)
        );
    }

    /**
     * Gets events formatted for dropdown/select components
     */
    static getEventsForSelect(): Array<{ value: TEventId; label: string }> {
        return this.getAllEvents().map(event => ({
            value: event.eventId,
            label: event.title
        }));
    }

    /**
     * Gets only events with passages for dropdown/select components
     */
    static getEventsWithPassagesForSelect(): Array<{ value: TEventId; label: string }> {
        return this.getEventsWithPassages().map(event => ({
            value: event.eventId,
            label: event.title
        }));
    }

    /**
     * Gets event details including passage count
     */
    static async getEventDetails<E extends TEventId>(eventId: E): Promise<{
        event: TEvent<E>;
        passageCount?: number;
        passageIds?: string[];
    } | null> {
        if (!this.eventExists(eventId)) {
            return null;
        }

        const event = this.getEvent(eventId);
        const details: any = { event };

        if (this.eventHasPassages(eventId)) {
            try {
                // Import PassageResolver dynamically to avoid circular dependencies
                const { PassageResolver } = await import('./PassageResolver');
                const passageIds = await PassageResolver.getAvailablePassageIds(eventId);
                details.passageCount = passageIds.length;
                details.passageIds = passageIds;
            } catch (error) {
                console.warn(`Could not load passage details for event '${eventId}':`, error);
            }
        }

        return details;
    }

    /**
     * Gets event by title (case-insensitive)
     */
    static getEventByTitle(eventTitle: string): TEvent<TEventId> | null {
        const allEvents = this.getAllEvents();
        return allEvents.find(event => 
            event.title.toLowerCase() === eventTitle.toLowerCase()
        ) || null;
    }

    /**
     * Gets events by location
     */
    static getEventsByLocation(locationId: string): TEvent<TEventId>[] {
        const allEvents = this.getAllEvents();
        return allEvents.filter(event => event.location === locationId);
    }

    /**
     * Gets events within a time range (using seconds)
     */
    static getEventsByTimeRange(startTime?: number, endTime?: number): TEvent<TEventId>[];
    /**
     * Gets events within a time range (using Time objects)
     */
    static getEventsByTimeRange(startTime?: Time, endTime?: Time): TEvent<TEventId>[];
    static getEventsByTimeRange(startTime?: number | Time, endTime?: number | Time): TEvent<TEventId>[] {
        if (!startTime && !endTime) return [];
        
        // Convert Time objects to seconds if needed
        const startTimeS = startTime instanceof Time ? startTime.s : startTime;
        const endTimeS = endTime instanceof Time ? endTime.s : endTime;
        
        const allEvents = this.getAllEvents();
        return allEvents.filter(event => {
            const eventTimeRange = event.timeRange;
            if (!eventTimeRange) return false;
            
            const eventStart = eventTimeRange.start.s; // Convert Time to seconds
            const eventEnd = eventTimeRange.end.s;     // Convert Time to seconds
            
            if (startTimeS && endTimeS) {
                return eventStart <= endTimeS && eventEnd >= startTimeS;
            } else if (startTimeS) {
                return eventEnd >= startTimeS;
            } else if (endTimeS) {
                return eventStart <= endTimeS;
            }
            return false;
        });
    }

    /**
     * Gets multiple events by IDs
     */
    static getMultipleEvents<E extends TEventId>(eventIds: E[]): TEvent<E>[] {
        return eventIds.map(id => this.getEvent(id));
    }

    /**
     * Gets child events from an event
     */
    static getChildEvents<E extends TEventId>(eventId: E): TEvent<TEventId>[] {
        const event = this.getEvent(eventId);
        return event.children.map(child => child.event);
    }

    /**
     * Gets all triggers from an event
     */
    static getEventTriggers<E extends TEventId>(eventId: E) {
        const event = this.getEvent(eventId);
        return event.triggers;
    }

    /**
     * Preloads all events into cache (useful for performance if events require processing)
     */
    static preloadAllEvents(): void {
        const allEventIds = this.getAvailableEventIds();
        allEventIds.forEach(eventId => {
            this.getEvent(eventId); // This will cache the event
        });
    }

    /**
     * Clears the event cache (useful for hot reloading in development)
     */
    static clearCache(): void {
        this.eventCache.clear();
    }

    /**
     * Gets event statistics
     */
    static getEventStats(): {
        totalEvents: number;
        eventsWithPassages: number;
        eventsWithoutPassages: number;
        eventsByLocation: { [locationId: string]: number };
    } {
        const allEvents = this.getAllEvents();
        const eventsWithPassages = this.getEventsWithPassages();
        
        // Count events by location
        const eventsByLocation: { [locationId: string]: number } = {};
        allEvents.forEach(event => {
            const location = event.location;
            eventsByLocation[location] = (eventsByLocation[location] || 0) + 1;
        });
        
        return {
            totalEvents: allEvents.length,
            eventsWithPassages: eventsWithPassages.length,
            eventsWithoutPassages: allEvents.length - eventsWithPassages.length,
            eventsByLocation
        };
    }

    /**
     * Validates event structure
     */
    static validateEvent<E extends TEventId>(eventId: E): {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    } {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!this.eventExists(eventId)) {
            errors.push(`Event '${eventId}' does not exist`);
            return { isValid: false, errors, warnings };
        }

        const event = this.getEvent(eventId);
        
        if (!event.title?.trim()) {
            errors.push(`Event '${eventId}' has no title`);
        }

        if (!event.description?.trim()) {
            warnings.push(`Event '${eventId}' has no description`);
        }

        if (!event.location) {
            warnings.push(`Event '${eventId}' has no location specified`);
        }

        if (!event.timeRange) {
            warnings.push(`Event '${eventId}' has no time range specified`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Gets events that occur at the same location
     */
    static getRelatedEventsByLocation<E extends TEventId>(eventId: E): TEvent<TEventId>[] {
        const event = this.getEvent(eventId);
        return this.getEventsByLocation(event.location).filter(e => e.eventId !== eventId);
    }

    /**
     * Gets events that have overlapping time ranges
     */
    static getRelatedEventsByTime<E extends TEventId>(eventId: E): TEvent<TEventId>[] {
        const event = this.getEvent(eventId);
        if (!event.timeRange) return [];
        
        return this.getEventsByTimeRange(event.timeRange.start.s, event.timeRange.end.s)
            .filter(e => e.eventId !== eventId);
    }
}