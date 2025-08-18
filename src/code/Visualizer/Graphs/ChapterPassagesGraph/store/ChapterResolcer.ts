import { TWorldState } from 'data/TWorldState';
import { Engine } from 'code/Engine/ts/Engine';
import { register } from 'data/register';
import { TChapter } from 'types/TChapter';
import { TChapterId } from 'types/TIds';
import { Time } from 'time/Time';

export class ChapterResolver {
    // Cache is used to avoid repeated expensive operations like dynamic imports or complex transformations
    // In this case, it's mainly useful if chapters require processing/initialization
    private static chapterCache = new Map<TChapterId, TChapter<any>>();

    /**
     * Resolves and returns a specific chapter by ID
     */
    static getChapter<E extends TChapterId>(
        chapterId: E,
        worldState?: TWorldState,
        engine?: Engine
    ): TChapter<E> {
        // Check cache first
        if (this.chapterCache.has(chapterId)) {
            return this.chapterCache.get(chapterId) as TChapter<E>;
        }

        // Check if chapter exists in register
        if (register.chapters[chapterId]) {
            const chapter = register.chapters[chapterId] as TChapter<E>;
            this.chapterCache.set(chapterId, chapter);
            return chapter;
        }

        throw new Error(`Chapter '${chapterId}' not found`);
    }

    /**
     * Gets all available chapters
     */
    static getAllChapters(): TChapter<TChapterId>[] {
        return Object.keys(register.chapters).map(chapterId => 
            this.getChapter(chapterId as TChapterId)
        );
    }

    /**
     * Gets all available chapter IDs
     */
    static getAvailableChapterIds(): TChapterId[] {
        return Object.keys(register.chapters) as TChapterId[];
    }

    /**
     * Gets chapters that have associated passages
     */
    static getChaptersWithPassages(): TChapter<TChapterId>[] {
        const chapterIdsWithPassages = Object.keys(register.passages) as TChapterId[];
        return chapterIdsWithPassages.map(chapterId => this.getChapter(chapterId));
    }

    /**
     * Gets chapters that don't have associated passages
     */
    static getChaptersWithoutPassages(): TChapter<TChapterId>[] {
        const allChapterIds = this.getAvailableChapterIds();
        const chapterIdsWithPassages = Object.keys(register.passages) as TChapterId[];
        const chapterIdsWithoutPassages = allChapterIds.filter(id => !chapterIdsWithPassages.includes(id));
        return chapterIdsWithoutPassages.map(chapterId => this.getChapter(chapterId));
    }

    /**
     * Gets chapter IDs that have associated passages
     */
    static getChapterIdsWithPassages(): TChapterId[] {
        return Object.keys(register.passages) as TChapterId[];
    }

    /**
     * Checks if an chapter exists
     */
    static chapterExists(chapterId: TChapterId): boolean {
        return register.chapters[chapterId] !== undefined;
    }

    /**
     * Checks if an chapter has associated passages
     */
    static chapterHasPassages(chapterId: TChapterId): boolean {
        return register.passages[chapterId] !== undefined;
    }

    /**
     * Searches chapters by title or description (case-insensitive)
     */
    static searchChapters(searchTerm: string): TChapter<TChapterId>[] {
        const allChapters = this.getAllChapters();
        const lowerSearchTerm = searchTerm.toLowerCase();
        
        return allChapters.filter(chapter => 
            chapter.title.toLowerCase().includes(lowerSearchTerm) ||
            chapter.description.toLowerCase().includes(lowerSearchTerm) ||
            chapter.chapterId.toLowerCase().includes(lowerSearchTerm)
        );
    }

    /**
     * Gets chapters formatted for dropdown/select components
     */
    static getChaptersForSelect(): Array<{ value: TChapterId; label: string }> {
        return this.getAllChapters().map(chapter => ({
            value: chapter.chapterId,
            label: chapter.title
        }));
    }

    /**
     * Gets only chapters with passages for dropdown/select components
     */
    static getChaptersWithPassagesForSelect(): Array<{ value: TChapterId; label: string }> {
        return this.getChaptersWithPassages().map(chapter => ({
            value: chapter.chapterId,
            label: chapter.title
        }));
    }

    /**
     * Gets chapter details including passage count
     */
    static async getChapterDetails<E extends TChapterId>(chapterId: E): Promise<{
        chapter: TChapter<E>;
        passageCount?: number;
        passageIds?: string[];
    } | null> {
        if (!this.chapterExists(chapterId)) {
            return null;
        }

        const chapter = this.getChapter(chapterId);
        const details: any = { chapter };

        if (this.chapterHasPassages(chapterId)) {
            try {
                // Import PassageResolver dynamically to avoid circular dependencies
                const { PassageResolver } = await import('./PassageResolver');
                const passageIds = await PassageResolver.getAvailablePassageIds(chapterId);
                details.passageCount = passageIds.length;
                details.passageIds = passageIds;
            } catch (error) {
                console.warn(`Could not load passage details for chapter '${chapterId}':`, error);
            }
        }

        return details;
    }

    /**
     * Gets chapter by title (case-insensitive)
     */
    static getChapterByTitle(chapterTitle: string): TChapter<TChapterId> | null {
        const allChapters = this.getAllChapters();
        return allChapters.find(chapter => 
            chapter.title.toLowerCase() === chapterTitle.toLowerCase()
        ) || null;
    }

    /**
     * Gets chapters by location
     */
    static getChaptersByLocation(locationId: string): TChapter<TChapterId>[] {
        const allChapters = this.getAllChapters();
        return allChapters.filter(chapter => chapter.location === locationId);
    }

    /**
     * Gets chapters within a time range (using seconds)
     */
    static getChaptersByTimeRange(startTime?: number, endTime?: number): TChapter<TChapterId>[];
    /**
     * Gets chapters within a time range (using Time objects)
     */
    static getChaptersByTimeRange(startTime?: Time, endTime?: Time): TChapter<TChapterId>[];
    static getChaptersByTimeRange(startTime?: number | Time, endTime?: number | Time): TChapter<TChapterId>[] {
        if (!startTime && !endTime) return [];
        
        // Convert Time objects to seconds if needed
        const startTimeS = startTime instanceof Time ? startTime.s : startTime;
        const endTimeS = endTime instanceof Time ? endTime.s : endTime;
        
        const allChapters = this.getAllChapters();
        return allChapters.filter(chapter => {
            const chapterTimeRange = chapter.timeRange;
            if (!chapterTimeRange) return false;
            
            const chapterStart = chapterTimeRange.start.s; // Convert Time to seconds
            const chapterEnd = chapterTimeRange.end.s;     // Convert Time to seconds
            
            if (startTimeS && endTimeS) {
                return chapterStart <= endTimeS && chapterEnd >= startTimeS;
            } else if (startTimeS) {
                return chapterEnd >= startTimeS;
            } else if (endTimeS) {
                return chapterStart <= endTimeS;
            }
            return false;
        });
    }

    /**
     * Gets multiple chapters by IDs
     */
    static getMultipleChapters<E extends TChapterId>(chapterIds: E[]): TChapter<E>[] {
        return chapterIds.map(id => this.getChapter(id));
    }

    /**
     * Gets child chapters from an chapter
     */
    static getChildChapters<E extends TChapterId>(chapterId: E): TChapter<TChapterId>[] {
        const chapter = this.getChapter(chapterId);
        return chapter.children.map(child => child.chapter);
    }

    /**
     * Gets all triggers from an chapter
     */
    static getChapterTriggers<E extends TChapterId>(chapterId: E) {
        const chapter = this.getChapter(chapterId);
        return chapter.triggers;
    }

    /**
     * Preloads all chapters into cache (useful for performance if chapters require processing)
     */
    static preloadAllChapters(): void {
        const allChapterIds = this.getAvailableChapterIds();
        allChapterIds.forEach(chapterId => {
            this.getChapter(chapterId); // This will cache the chapter
        });
    }

    /**
     * Clears the chapter cache (useful for hot reloading in development)
     */
    static clearCache(): void {
        this.chapterCache.clear();
    }

    /**
     * Gets chapter statistics
     */
    static getChapterStats(): {
        totalChapters: number;
        chaptersWithPassages: number;
        chaptersWithoutPassages: number;
        chaptersByLocation: { [locationId: string]: number };
    } {
        const allChapters = this.getAllChapters();
        const chaptersWithPassages = this.getChaptersWithPassages();
        
        // Count chapters by location
        const chaptersByLocation: { [locationId: string]: number } = {};
        allChapters.forEach(chapter => {
            const location = chapter.location;
            chaptersByLocation[location] = (chaptersByLocation[location] || 0) + 1;
        });
        
        return {
            totalChapters: allChapters.length,
            chaptersWithPassages: chaptersWithPassages.length,
            chaptersWithoutPassages: allChapters.length - chaptersWithPassages.length,
            chaptersByLocation
        };
    }

    /**
     * Validates chapter structure
     */
    static validateChapter<E extends TChapterId>(chapterId: E): {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    } {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!this.chapterExists(chapterId)) {
            errors.push(`Chapter '${chapterId}' does not exist`);
            return { isValid: false, errors, warnings };
        }

        const chapter = this.getChapter(chapterId);
        
        if (!chapter.title?.trim()) {
            errors.push(`Chapter '${chapterId}' has no title`);
        }

        if (!chapter.description?.trim()) {
            warnings.push(`Chapter '${chapterId}' has no description`);
        }

        if (!chapter.location) {
            warnings.push(`Chapter '${chapterId}' has no location specified`);
        }

        if (!chapter.timeRange) {
            warnings.push(`Chapter '${chapterId}' has no time range specified`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Gets chapters that occur at the same location
     */
    static getRelatedChaptersByLocation<E extends TChapterId>(chapterId: E): TChapter<TChapterId>[] {
        const chapter = this.getChapter(chapterId);
        return this.getChaptersByLocation(chapter.location).filter(e => e.chapterId !== chapterId);
    }

    /**
     * Gets chapters that have overlapping time ranges
     */
    static getRelatedChaptersByTime<E extends TChapterId>(chapterId: E): TChapter<TChapterId>[] {
        const chapter = this.getChapter(chapterId);
        if (!chapter.timeRange) return [];
        
        return this.getChaptersByTimeRange(chapter.timeRange.start.s, chapter.timeRange.end.s)
            .filter(e => e.chapterId !== chapterId);
    }
}