import { showToast } from '@story/ui';
import type { DeltaTime } from '@story/shared';
import {
    GLOBAL_MAP_ID,
    type TBodyItemDto,
    type TLinkCostDto,
    type TLinkDto,
    type TMapDto,
    type TMapFile,
} from '@story/visualizer-protocol';
import { ApiError, type TVisualizerApi } from '../api';
import type { TMapData } from '../MapEditor/types';

/**
 * **Legacy adapter** kept so the pre-WP1 forms and the map page keep working unchanged: it maps
 * their old call shapes onto the typed `api` (`client/src/api`). It replaces the old `Agent`,
 * `TypeConverters`, `HttpErrorHandler` and `nodeServerTypes`, which spoke a route list the server
 * never had and a hard-coded `http://localhost:3123`.
 *
 * New code should call `store.api` directly; this class goes away with the pages that use it
 * (WP4 map, WP5 timeline, WP6 chapter view).
 */

/** What the chapter creation form produces. */
export type TChapterData = {
    title: string;
    description: string;
    location: string;
    timeRange: { start: string; end: string };
    children?: Array<{ condition: string; chapterId: string }>;
};

/** What the screen passage creation form produces. */
export type TScreenPassageData = {
    chapterId: string;
    characterId: string;
    /** Local id (`intro`), not the full passage id. */
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
            cost?: { time?: DeltaTime; items?: { id: string; amount: number }[]; tools?: string[] };
        }>;
    }>;
};

const DEFAULT_TIME_RANGE = { start: '2.2. 12:00', end: '2.2. 14:00' };

const errorText = (error: unknown, fallback: string) => {
    if (error instanceof ApiError && error.isNotImplemented) {
        return _('%s: the Visualizer server does not implement this yet', fallback);
    }
    return error instanceof Error ? `${fallback}: ${error.message}` : fallback;
};

const toCostDto = (cost: NonNullable<TScreenPassageData['body'][number]['links']>[number]['cost']) => {
    if (!cost) return undefined;
    const dto: TLinkCostDto = {};
    if (cost.time) dto.time = { seconds: cost.time.s };
    if (cost.items?.length) dto.items = cost.items;
    if (cost.tools?.length) dto.tools = cost.tools;
    return Object.keys(dto).length > 0 ? dto : undefined;
};

/** The map editor's `TMapData` ↔ the protocol's `TMapDto` (`label` is the same field; `locations` changed shape). */
export const mapDtoToMapData = (dto: TMapDto): TMapData => ({
    mapId: dto.mapId,
    title: dto.title,
    width: dto.width,
    height: dto.height,
    data: dto.data.map((row) => row.map((tile) => ({ tile: tile.tile, label: tile.label }))),
    locations: [],
    maps: dto.maps,
    palette: dto.palette,
});

export const mapDataToMapFile = (data: TMapData, previous?: TMapDto): TMapFile => ({
    mapId: data.mapId,
    title: data.title,
    width: data.width,
    height: data.height,
    data: data.data.map((row, i) =>
        row.map((tile, j) => ({
            ...previous?.data[i]?.[j],
            tile: tile.tile,
            label: tile.label,
        }))
    ),
    palette: data.palette,
    locations: previous?.locations ?? {},
    maps: data.maps,
});

export class Agent {
    /** The last map DTO seen per map id — its version is what the next save is based on. */
    private maps = new Map<string, TMapDto>();

    constructor(public api: TVisualizerApi) {}

    /** Create a chapter (the old "add or update" endpoint only ever created). */
    updateChapter = async (chapterId: string, data: TChapterData) => {
        try {
            await this.api.createChapter({
                chapterId,
                title: data.title,
                description: data.description,
                location: data.location,
                timeRange: {
                    start: data.timeRange.start || DEFAULT_TIME_RANGE.start,
                    end: data.timeRange.end || DEFAULT_TIME_RANGE.end,
                },
            });
            showToast(_('Chapter %s added', chapterId), { variant: 'success' });
        } catch (error) {
            console.error('Add chapter error:', error);
            showToast(errorText(error, _('Failed to add chapter %s', chapterId)), { variant: 'error' });
            throw error;
        }
    };

    openChapter = async (chapterId: string) => {
        try {
            await this.api.openChapter(chapterId);
        } catch (error) {
            showToast(errorText(error, _('Failed to open chapter %s', chapterId)), { variant: 'error' });
        }
    };

    openPassage = async (passageId: string) => {
        try {
            await this.api.openPassage(passageId);
        } catch (error) {
            showToast(errorText(error, _('Failed to open passage %s', passageId)), { variant: 'error' });
        }
    };

    /** Create a screen passage, then fill in the fields the create call does not take. */
    addScreenPassage = async (passageId: string, data: TScreenPassageData) => {
        try {
            const created = await this.api.createPassage(data.chapterId, {
                characterId: data.characterId,
                localId: data.id,
                type: 'screen',
                title: data.title,
            });
            const body: TBodyItemDto[] = data.body.map((item) => ({
                ...(item.text !== undefined && { text: item.text }),
                ...(item.redirect && { redirect: item.redirect }),
                links: (item.links ?? []).map(
                    (link): TLinkDto => ({
                        text: link.text,
                        passageId: link.passageId,
                        ...(link.autoPriority && { autoPriortiy: link.autoPriority }),
                        ...(toCostDto(link.cost) && { cost: toCostDto(link.cost) }),
                    })
                ),
            }));
            await this.api.updatePassage(created.passageId, {
                version: created.version,
                title: data.title,
                image: data.image,
                body,
            });
            showToast(_('Passage %s added', passageId), { variant: 'success' });
        } catch (error) {
            console.error('Add screen passage error:', error);
            showToast(errorText(error, _('Failed to add passage %s', passageId)), { variant: 'error' });
            throw error;
        }
    };

    getMap = async (mapId: string = GLOBAL_MAP_ID): Promise<TMapData> => {
        const dto = await this.api.getMap(mapId);
        this.maps.set(mapId, dto);
        return mapDtoToMapData(dto);
    };

    saveMap = async (mapData: TMapData) => {
        try {
            const previous = this.maps.get(mapData.mapId);
            const saved = await this.api.updateMap(mapData.mapId, {
                ...mapDataToMapFile(mapData, previous),
                version: previous?.version ?? '',
            });
            this.maps.set(mapData.mapId, saved);
            showToast(_('Map %s saved', mapData.title), { variant: 'success' });
        } catch (error) {
            console.error('Save map error:', error);
            showToast(errorText(error, _('Failed to save map %s', mapData.title)), { variant: 'error' });
        }
    };
}
