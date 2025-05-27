import { TLocationId } from 'types/TLocation';
import { TEventPassageType } from 'types/TPassage';
import { TMapData } from '../MapEditor/types';
import { TEventData, EventUpdateRequest, TPassageData, PassageUpdateRequest, MapData, SetTimeRequest } from './ nodeServerTypes';


export class TypeConverters {

  // Event converters
  static eventDataToUpdateRequest(eventData: TEventData): EventUpdateRequest {
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

  // Passage converters
  static passageDataToUpdateRequest(passageData: TPassageData): PassageUpdateRequest {
    return {
      type: passageData.type,
      title: passageData.title
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
