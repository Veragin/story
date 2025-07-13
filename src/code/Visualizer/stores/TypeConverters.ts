import { TLocationId } from 'types/TLocation';
import { TEventPassageType } from 'types/TPassage';
import { TMapData } from '../MapEditor/types';
import { EventUpdateRequest, MapData, PassageUpdateRequest, SetTimeRequest, TEventData, TPassageData, TScreenPassageData } from './ nodeServerTypes';
import { TEventId } from 'types/TIds';


export class TypeConverters {
  // Event converters
  static eventDataToUpdateRequest(eventData: TEventData): EventUpdateRequest {
    const originTime = { start: '2.2. 12:00', end: '2.2. 14:00' };

    if (eventData.timeRange.start === '')
      eventData.timeRange.start = originTime.start;
    if (eventData.timeRange.end === '')
      eventData.timeRange.end = originTime.end;

    return {
      title: eventData.title,
      description: eventData.description,
      location: eventData.location,
      timeRange: {
        start: eventData.timeRange.start,
        end: eventData.timeRange.end
      }
    };
  }

  static updateRequestToEventData(updateRequest: EventUpdateRequest, fallbackLocation: TLocationId): TEventData {
    return {
      title: updateRequest.title || '',
      description: updateRequest.description || '',
      location: updateRequest.location as TLocationId || fallbackLocation,
      timeRange: {
        start: updateRequest.timeRange?.start || '',
        end: updateRequest.timeRange?.end || ''
      }
    };
  }

  static passageDataToUpdateRequest(passageData: TPassageData): PassageUpdateRequest {
    return {
      type: passageData.type,
      title: passageData.title
    };
  }

  static screenPassageDataToUpdateRequest(screenPassageData: TScreenPassageData): PassageUpdateRequest {
    return {
      type: screenPassageData.type,
      eventId: screenPassageData.eventId as TEventId,
      characterId: screenPassageData.characterId,
      id: screenPassageData.id,
      title: screenPassageData.title,
      image: screenPassageData.image,
      body: screenPassageData.body.map(bodyItem => ({
        text: bodyItem.text,
        redirect: bodyItem.redirect,
        links: bodyItem.links?.map(link => ({
          text: link.text,
          passageId: link.passageId,
          autoPriority: link.autoPriority,
          cost: link.cost
        }))
      }))
    };
  }

  static updateRequestToPassageData(updateRequest: PassageUpdateRequest): TPassageData {
    return {
      type: updateRequest.type as TEventPassageType,
      title: updateRequest.title
    };
  }

  // Map converters
  static mapDataToServerType(clientMapData: TMapData): MapData {
    return {
      mapId: clientMapData.mapId,
      title: clientMapData.title,
      width: clientMapData.width,
      height: clientMapData.height,
      data: clientMapData.data.map(row => row.map(cell => ({
        tile: cell.tile,
        title: cell.label // Convert label to title
      }))
      ),
      locations: clientMapData.locations.map(loc => ({
        i: loc.i,
        j: loc.j,
        locationId: loc.locationId
      })),
      maps: clientMapData.maps.map(map => ({
        i: map.i,
        j: map.j,
        mapId: map.mapId
      })),
      palette: clientMapData.palette
    };
  }

  static serverTypeToMapData(serverMapData: MapData): TMapData {
    return {
      mapId: serverMapData.mapId,
      title: serverMapData.title,
      width: serverMapData.width,
      height: serverMapData.height,
      data: serverMapData.data.map(row => row.map(cell => ({
        tile: cell.tile,
        label: cell.title // Convert title to label
      }))
      ),
      locations: serverMapData.locations.map(loc => ({
        i: loc.i,
        j: loc.j,
        locationId: loc.locationId
      })),
      maps: serverMapData.maps.map(map => ({
        i: map.i,
        j: map.j,
        mapId: map.mapId
      })),
      palette: serverMapData.palette
    };
  }

  // Time range converters
  static createSetTimeRequest(timeRange: { start: string; end: string; }): SetTimeRequest {
    return {
      timeRange: {
        start: timeRange.start,
        end: timeRange.end
      }
    };
  }

  static extractTimeRange(setTimeRequest: SetTimeRequest): { start: string; end: string; } {
    return {
      start: setTimeRequest.timeRange.start,
      end: setTimeRequest.timeRange.end
    };
  }
}