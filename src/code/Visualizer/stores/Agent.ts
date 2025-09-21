import { showToast } from 'code/theme/GlobalThemeWrapper';
import { TLocationId } from 'types/TLocation';
import { TChapterPassageType } from 'types/TPassage';
import { TMapData } from '../MapEditor/types';
import { TypeConverters } from './TypeConverters';
import { HttpErrorHandler } from './HttpErrorHandler';
import { MapResponse, TChapterData, TScreenPassageData } from './ nodeServerTypes';

/**
 * Agent class for handling API communication with the WorldsFactory backend
 */
export class Agent {
    constructor(public url: string) {}

    /**
     * Add or update an chapter
     */
    updateChapter = async (chapterId: string, data: TChapterData) => {
        try {
            const serverData = TypeConverters.chapterDataToUpdateRequest(data);

            console.log(`Adding chapter ${chapterId} with data:`, serverData);

            await HttpErrorHandler.fetchWithErrorHandling(
                `${this.url}/api/chapter/${chapterId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(serverData),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
                `add chapter ${chapterId}`
            );

            showToast(_('Chapter %s added', chapterId), { variant: 'success' });
        } catch (error) {
            console.error('Add chapter error:', error);
            const errorMessage = error instanceof Error ? error.message : `Failed to add chapter ${chapterId}`;
            showToast(errorMessage, { variant: 'error' });
        }
    };

    /**
     * Open an chapter in VS Code
     */
    openChapter = async (chapterId: string) => {
        try {
            await HttpErrorHandler.fetchWithErrorHandling(
                `${this.url}/api/chapter/${chapterId}/open`,
                {
                    method: 'POST',
                },
                `open chapter ${chapterId}`
            );

            showToast(_('Chapter %s opened', chapterId), { variant: 'success' });
        } catch (error) {
            console.error('Open chapter error:', error);
            const errorMessage = error instanceof Error ? error.message : `Failed to open chapter ${chapterId}`;
            showToast(errorMessage, { variant: 'error' });
        }
    };

    /**
     * Delete an chapter
     */
    deleteChapter = async (chapterId: string) => {
        try {
            await HttpErrorHandler.fetchWithErrorHandling(
                `${this.url}/api/chapter/${chapterId}`,
                {
                    method: 'DELETE',
                },
                `delete chapter ${chapterId}`
            );

            showToast(_('Chapter %s deleted', chapterId), { variant: 'success' });
        } catch (error) {
            console.error('Delete chapter error:', error);
            const errorMessage = error instanceof Error ? error.message : `Failed to delete chapter ${chapterId}`;
            showToast(errorMessage, { variant: 'error' });
        }
    };

    /**
     * Set time range for an chapter
     */
    setChapterTime = async (chapterId: string, data: { timeRange: { start: string; end: string } }) => {
        try {
            const serverData = TypeConverters.createSetTimeRequest(data.timeRange);

            console.log(`Setting time for chapter ${chapterId} with data:`, serverData);

            await HttpErrorHandler.fetchWithErrorHandling(
                `${this.url}/api/chapter/${chapterId}/setTime`,
                {
                    method: 'POST',
                    body: JSON.stringify(serverData),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
                `set time for chapter ${chapterId}`
            );
        } catch (error) {
            console.error('Set chapter time error:', error);
            const errorMessage = error instanceof Error ? error.message : `Failed to set time for chapter ${chapterId}`;
            showToast(errorMessage, { variant: 'error' });
        }
    };

    /**
     * Add or update a screen passage
     */
    addScreenPassage = async (passageId: string, data: TScreenPassageData) => {
        try {
            const serverData = TypeConverters.screenPassageDataToUpdateRequest(data);

            console.log(`Adding screen passage ${passageId} with data:`, serverData);

            await HttpErrorHandler.fetchWithErrorHandling(
                `${this.url}/api/passage/screen/${passageId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(serverData),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
                `add screen passage ${passageId}`
            );

            showToast(_('Passage %s added', passageId), { variant: 'success' });
        } catch (error) {
            console.error('Add screen passage error:', error);
            const errorMessage = error instanceof Error ? error.message : `Failed to add passage ${passageId}`;
            showToast(errorMessage, { variant: 'error' });
        }
    };

    /**
     * Open a passage in VS Code
     */
    openPassage = async (passageId: string) => {
        try {
            await HttpErrorHandler.fetchWithErrorHandling(
                `${this.url}/api/passage/screen/${passageId}/open`,
                {
                    method: 'POST',
                },
                `open passage ${passageId}`
            );

            showToast(_('Passage %s opened', passageId), { variant: 'success' });
        } catch (error) {
            console.error('Open passage error:', error);
            const errorMessage = error instanceof Error ? error.message : `Failed to open passage ${passageId}`;
            showToast(errorMessage, { variant: 'error' });
        }
    };

    /**
     * Delete a passage
     */
    deletePassage = async (passageId: string) => {
        try {
            await HttpErrorHandler.fetchWithErrorHandling(
                `${this.url}/api/passage/screen/${passageId}`,
                {
                    method: 'DELETE',
                },
                `delete passage ${passageId}`
            );

            showToast(_('Passage %s deleted', passageId), { variant: 'success' });
        } catch (error) {
            console.error('Delete passage error:', error);
            const errorMessage = error instanceof Error ? error.message : `Failed to delete passage ${passageId}`;
            showToast(errorMessage, { variant: 'error' });
        }
    };

    /**
     * Set time range for a passage
     */
    setPassageTime = async (passageId: string, data: { timeRange: { start: string; end: string } }) => {
        try {
            const serverData = TypeConverters.createSetTimeRequest(data.timeRange);

            console.log(`Setting time for passage ${passageId} with data:`, serverData);

            await HttpErrorHandler.fetchWithErrorHandling(
                `${this.url}/api/passage/screen/${passageId}/setTime`,
                {
                    method: 'POST',
                    body: JSON.stringify(serverData),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
                `set time for passage ${passageId}`
            );
        } catch (error) {
            console.error('Set passage time error:', error);
            const errorMessage = error instanceof Error ? error.message : `Failed to set time for passage ${passageId}`;
            showToast(errorMessage, { variant: 'error' });
        }
    };

    getMap = async (mapId: string): Promise<TMapData> => {
        try {
            const mapResponse: MapResponse = await HttpErrorHandler.fetchWithErrorHandling(
                `${this.url}/api/map/${mapId}`,
                {
                    method: 'GET',
                },
                `get map ${mapId}`
            );

            return TypeConverters.serverTypeToMapData(mapResponse.data);
        } catch (error) {
            console.error('Get map error:', error);
            const errorMessage = error instanceof Error ? error.message : `Failed to get map ${mapId}`;
            showToast(errorMessage, { variant: 'error' });
            throw error; // Re-throw for caller to handle
        }
    };

    /**
     * Get list of all available map IDs
     */
    getMapList = async (): Promise<string[]> => {
        try {
            const mapListResponse = await HttpErrorHandler.fetchWithErrorHandling(
                `${this.url}/api/map`,
                {
                    method: 'GET',
                },
                'get map list'
            );

            return mapListResponse.data;
        } catch (error) {
            console.error('Get map list error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to get map list';
            showToast(errorMessage, { variant: 'error' });
            throw error; // Re-throw for caller to handle
        }
    };

    /**
     * Save or update map data
     */
    saveMap = async (mapData: TMapData) => {
        try {
            const serverData = TypeConverters.mapDataToServerType(mapData);

            console.log(`Saving map ${mapData.mapId} with data:`, serverData);

            await HttpErrorHandler.fetchWithErrorHandling(
                `${this.url}/api/map/${mapData.mapId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(serverData),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
                `save map ${mapData.title}`
            );

            showToast(_('Map %s saved', mapData.title), { variant: 'success' });
        } catch (error) {
            console.error('Save map error:', error);
            const errorMessage = error instanceof Error ? error.message : `Failed to save map ${mapData.title}`;
            showToast(errorMessage, { variant: 'error' });
        }
    };
}
