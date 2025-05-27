import { showToast } from 'code/GlobalWrapper';
import { TLocationId } from 'types/TLocation';
import { TEventPassageType } from 'types/TPassage';
import { TMapData } from '../MapEditor/types';
import { TypeConverters } from './TypeConverters';
import { MapResponse, TEventData, TPassageData as TScreenPassageData } from './ nodeServerTypes';

export class Agent {
    constructor(public url: string) {}

    addEvent = async (eventId: string, data: TEventData) => {
        try {
            const serverData = TypeConverters.eventDataToUpdateRequest(data);
            await fetch(`${this.url}/api/event/${eventId}`, {
                method: 'PUT',
                body: JSON.stringify(serverData),
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            showToast(_('Event %s added', eventId), { variant: 'success' });
        } catch (e) {
            console.error(e);
            showToast(_('Failed to add event %s', eventId), { variant: 'error' });
        }
    };

    openEvent = async (eventId: string) => {
        try {
            await fetch(`${this.url}/api/event/${eventId}/open`, {
                method: 'POST',
            });
            showToast(_('Event %s opened', eventId), { variant: 'success' });
        } catch (e) {
            console.error(e);
            showToast(_('Failed to open event %s', eventId), { variant: 'error' });
        }
    };

    deleteEvent = async (eventId: string) => {
        try {
            await fetch(`${this.url}/api/event/${eventId}`, {
                method: 'DELETE',
            });
            showToast(_('Event %s deleted', eventId), { variant: 'success' });
        } catch (e) {
            console.error(e);
            showToast(_('Failed to delete event %s', eventId), { variant: 'error' });
        }
    };

    setEventTime = async (eventId: string, data: { timeRange: { start: string; end: string } }) => {
        try {
            const serverData = TypeConverters.createSetTimeRequest(data.timeRange);
            await fetch(`${this.url}/api/event/${eventId}/setTime`, {
                method: 'POST',
                body: JSON.stringify(serverData),
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        } catch (e) {
            console.error(e);
        }
    };

    addScreenPassage = async (passageId: string, data: TScreenPassageData) => {
        try {
            const serverData = TypeConverters.passageDataToUpdateRequest(data);
            await fetch(`${this.url}/api/passage/screen/${passageId}`, {
                method: 'PUT',
                body: JSON.stringify(serverData),
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            showToast(_('Passage %s added', passageId), { variant: 'success' });
        } catch (e) {
            console.error(e);
            showToast(_('Failed to add passage %s', passageId), { variant: 'error' });
        }
    };

    openPassage = async (passageId: string) => {
        try {
            await fetch(`${this.url}/api/passage/screen/${passageId}/open`, {
                method: 'POST',
            });
            showToast(_('Passage %s opened', passageId), { variant: 'success' });
        } catch (e) {
            console.error(e);
            showToast(_('Failed to open passage %s', passageId), { variant: 'error' });
        }
    };

    deletePassage = async (passageId: string) => {
        try {
            await fetch(`${this.url}/api/passage/screen/${passageId}`, {
                method: 'DELETE',
            });
            showToast(_('Passage %s deleted', passageId), { variant: 'success' });
        } catch (e) {
            console.error(e);
            showToast(_('Failed to delete passage %s', passageId), { variant: 'error' });
        }
    };

    setPassageTime = async (passageId: string, data: { timeRange: { start: string; end: string } }) => {
        try {
            const serverData = TypeConverters.createSetTimeRequest(data.timeRange);
            await fetch(`${this.url}/api/passage/screen/${passageId}/setTime`, {
                method: 'POST',
                body: JSON.stringify(serverData),
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        } catch (e) {
            console.error(e);
        }
    };

    getMap = async (mapId: string): Promise<TMapData> => {
        try {
            const response = await fetch(`${this.url}/api/map/${mapId}`, {
                method: 'GET',
            });
            if (response.status !== 200) {
                throw new Error(`Failed to fetch map: ${response.statusText}`);
            }
            const mapResponse: MapResponse = await response.json();
            return TypeConverters.serverTypeToMapData(mapResponse.data);
        } catch (e) {
            console.error(e);
            showToast(_('Failed to get map %s', mapId), { variant: 'error' });
            throw e;
        }
    };

    getMapList = async (): Promise<string[]> => {
        try {
            const response = await fetch(`${this.url}/api/map`, {
                method: 'GET',
            });
            if (response.status !== 200) {
                throw new Error(`Failed to fetch map list: ${response.statusText}`);
            }
            const mapListResponse = await response.json();
            return mapListResponse.data;
        } catch (e) {
            console.error(e);
            showToast(_('Failed to get map list'), { variant: 'error' });
            throw e;
        }
    };

    saveMap = async (mapData: TMapData) => {
        try {
            const serverData = TypeConverters.mapDataToServerType(mapData);
            await fetch(`${this.url}/api/map/${mapData.mapId}`, {
                method: 'PUT',
                body: JSON.stringify(serverData),
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            showToast(_('Map %s saved', mapData.title), { variant: 'success' });
        } catch (e) {
            console.error(e);
            showToast(_('Failed to save map %s', mapData.title), { variant: 'error' });
        }
    };
}

