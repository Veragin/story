import { TLocationId } from 'types/TLocation';
import { TChapterPassageType } from 'types/TPassage';
import { TChapterId } from 'types/TIds';

// Updated server types to include missing fields
export interface TimeRange {
  start: string;
  end: string;
}

export interface ChapterUpdateRequest {
  title?: string;
  description?: string;
  location?: string;
  timeRange?: TimeRange;
  children?: Array<{ condition: string; chapterId: string; }>;
}

export interface SetTimeRequest {
  timeRange: TimeRange;
}

export interface TLinkCostItem {
  id: string;
  amount: number;
}

export interface TLinkCostObjectUpdateRequest {
  time?: {
    value: number;
    unit: 'min' | 'hour' | 'day';
  };
  items?: TLinkCostItem[];
  tools?: string[];
}

export type TLinkCostUpdateRequest =
  | { value: number; unit: 'min' | 'hour' | 'day' }
  | TLinkCostObjectUpdateRequest;

export interface TLinkUpdateRequest {
  text?: string;
  passageId?: string;
  autoPriority?: number;
  cost?: TLinkCostUpdateRequest;
}

export interface TPassageScreenBodyItemUpdateRequest {
  condition?: boolean;
  redirect?: string;
  text?: string;
  links?: TLinkUpdateRequest[];
}

export interface PassageUpdateRequest {
  type: 'screen' | 'linear' | 'transition';
  chapterId?: TChapterId;
  characterId?: string;
  id?: string;
  title?: string;
  image?: string;
  body?: TPassageScreenBodyItemUpdateRequest[];
  description?: string;
  nextPassageId?: string;
}

export interface SuccessResponse {
  success: boolean;
  message?: string;
}

export interface ErrorResponse {
  success: boolean;
  error: string;
}

export interface MapTileData {
  tile: string;
  title?: string;
}

export interface MapLocationReference {
  i: number;
  j: number;
  locationId: string;
}

export interface MapMapReference {
  i: number;
  j: number;
  mapId: string;
}

export interface MapData {
  mapId: string;  // Added missing field
  title: string;
  width: number;
  height: number;
  data: MapTileData[][];
  locations: MapLocationReference[];
  maps: MapMapReference[];
  palette: Record<string, { name: string; color: string; }>;
}

export interface MapUpdateRequest extends MapData {}

export interface MapResponse {
  success: boolean;
  data: MapData;
}

export interface MapListResponse {
  success: boolean;
  data: string[];
}

export type TChapterData = {
  title: string;
  description: string;
  location: string;
  timeRange: {
    start: string;
    end: string;
  };
  children?: Array<{ condition: string; chapterId: string; }>;
};

export type TPassageData = {
  type: TChapterPassageType;
  title?: string;
};

export type TScreenPassageData = {
  type: TChapterPassageType;
  chapterId: string;
  characterId: string;
  id: string;
  title: string;
  image: string;
  body: Array<{
    text?: string;
    redirect?: string;
    links?: Array<{
      text: string;
      passageId: string;
      autoPriority: number;
      cost?: any; // You might want to define TLinkCost type more specifically
    }>;
  }>;
};