import { showToast } from '@story/ui';
import { HttpErrorHandler } from './HttpErrorHandler';
import type { TChapterData, TScreenPassageData } from './nodeServerTypes';
import { TypeConverters } from './TypeConverters';
import type {
    TChapterSummary,
    TLocationSummary,
    TMapSummary,
    TPassageSummary,
    TStoryIndex,
} from '../../../server/src/story/types';
import type { TEntityDetail, TEntityKind } from '../../../server/src/entity/EntityService';
import type { TStructureType } from '../../../server/src/structure/StructureService';

/**
 * The client's half of the Visualizer API (VISUALIZER_PLAN §5.3).
 *
 * ## The wire types are imported from the server
 *
 * `TStoryIndex` and friends are declared once, in `Visualizer/server/src/story/types.ts`, and
 * imported here **type-only**. The client and the server are two processes of *one* service —
 * eslint's "no service may import another service" rule treats all of `Visualizer/` as one — so
 * this is not a boundary violation, and the import is erased at build time, so nothing of the
 * server reaches the bundle.
 *
 * The alternative was hand-mirroring twelve response shapes in `nodeServerTypes.ts` and
 * discovering each drift at runtime. That file is what this replaces, and it is deleted with the
 * legacy map model in Phase 6.
 *
 * ## Base URL
 *
 * Empty, i.e. same-origin (§5.4). Requests go to `/api/…` and Vite's dev proxy forwards them to
 * `http://localhost:8123`. The class this replaces hard-coded `http://localhost:3123` — a port
 * no config in the repo has ever mentioned, for a server that did not exist — so every call
 * failed and toasted.
 */
export class Agent {
    /**
     * @param url Base URL. Defaults to same-origin, which is what the Vite proxy expects.
     *            An absolute URL is still accepted, for pointing a client at another machine.
     */
    constructor(public url: string = '') {}

    private endpoint(path: string): string {
        return `${this.url}/api${path}`;
    }

    /* ------------------------------------------------------------------ reads */

    /** `GET /api/health` — used to tell "server is down" from "route is wrong". */
    checkHealth = async (): Promise<boolean> => {
        try {
            await HttpErrorHandler.fetchWithErrorHandling(this.endpoint('/health'), { method: 'GET' }, 'health check');
            return true;
        } catch {
            // Deliberately silent: the caller decides whether a dead server is worth a toast,
            // and a health probe that toasts on failure would toast on every poll.
            return false;
        }
    };

    /** `GET /api/story` — ids and titles of everything, one round trip at boot (§5.3). */
    getStory = async (): Promise<TStoryIndex> =>
        await HttpErrorHandler.fetchWithErrorHandling(this.endpoint('/story'), { method: 'GET' }, 'load story');

    getChapters = async (): Promise<TChapterSummary[]> =>
        await HttpErrorHandler.fetchWithErrorHandling(this.endpoint('/chapter'), { method: 'GET' }, 'load chapters');

    getChapter = async (chapterId: string): Promise<TChapterSummary> =>
        await HttpErrorHandler.fetchWithErrorHandling(
            this.endpoint(`/chapter/${encodeURIComponent(chapterId)}`),
            { method: 'GET' },
            `load chapter ${chapterId}`
        );

    /** The chapter view's first request: one chapter's passages with the static link graph. */
    getChapterPassages = async (chapterId: string): Promise<TPassageSummary[]> =>
        await HttpErrorHandler.fetchWithErrorHandling(
            this.endpoint(`/chapter/${encodeURIComponent(chapterId)}/passages`),
            { method: 'GET' },
            `load passages for ${chapterId}`
        );

    getMaps = async (): Promise<TMapSummary[]> =>
        await HttpErrorHandler.fetchWithErrorHandling(this.endpoint('/map'), { method: 'GET' }, 'load maps');

    getMapById = async (mapId: string): Promise<TMapSummary> =>
        await HttpErrorHandler.fetchWithErrorHandling(
            this.endpoint(`/map/${encodeURIComponent(mapId)}`),
            { method: 'GET' },
            `load map ${mapId}`
        );

    getLocations = async (): Promise<TLocationSummary[]> =>
        await HttpErrorHandler.fetchWithErrorHandling(this.endpoint('/location'), { method: 'GET' }, 'load locations');

    getLocation = async (locationId: string): Promise<TLocationSummary> =>
        await HttpErrorHandler.fetchWithErrorHandling(
            this.endpoint(`/location/${encodeURIComponent(locationId)}`),
            { method: 'GET' },
            `load location ${locationId}`
        );

    /* -------------------------------------------------------------- entities */

    /** `GET /api/entity` — the kinds and their members (§5.3). */
    getEntities = async (): Promise<TEntityKind[]> =>
        await HttpErrorHandler.fetchWithErrorHandling<TEntityKind[]>(
            this.endpoint('/entity'),
            { method: 'GET' },
            'load entities'
        );

    getEntity = async (kind: string, id: string): Promise<TEntityDetail> =>
        await HttpErrorHandler.fetchWithErrorHandling<TEntityDetail>(
            this.endpoint(`/entity/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`),
            { method: 'GET' },
            `load ${kind} ${id}`
        );

    updateEntity = async (
        kind: string,
        id: string,
        fields: Record<string, string | number | boolean>,
        hash?: string
    ): Promise<TEntityDetail> =>
        await HttpErrorHandler.fetchWithErrorHandling<TEntityDetail>(
            this.endpoint(`/entity/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`),
            { method: 'PUT', body: JSON.stringify({ fields }), headers: withIfMatch(hash) },
            `save ${kind} ${id}`
        );

    openEntity = async (kind: string, id: string): Promise<void> =>
        await this.open(`/entity/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/open`, `${kind} ${id}`);

    /* ------------------------------------------------------------- structure */

    /** `GET /api/structure` — the type aliases in `types/` (§5.3, Phase 10). */
    getStructure = async (): Promise<TStructureType[]> =>
        await HttpErrorHandler.fetchWithErrorHandling<TStructureType[]>(
            this.endpoint('/structure'),
            { method: 'GET' },
            'load the structure'
        );

    /**
     * `PUT /api/structure/:typeName` — add, change or remove a field.
     *
     * The server typechecks the result and rolls back if it fails, so a rejection here carries
     * `tsc`'s own message and the file on disk is unchanged.
     */
    updateStructure = async (
        typeName: string,
        edits: { action: 'add' | 'update' | 'remove'; name: string; type?: string; optional?: boolean; doc?: string }[],
        hash?: string
    ): Promise<TStructureType> =>
        await HttpErrorHandler.fetchWithErrorHandling<TStructureType>(
            this.endpoint(`/structure/${encodeURIComponent(typeName)}`),
            { method: 'PUT', body: JSON.stringify({ edits }), headers: withIfMatch(hash) },
            `save ${typeName}`
        );

    openStructure = async (typeName: string): Promise<void> =>
        await this.open(`/structure/${encodeURIComponent(typeName)}/open`, typeName);

    /* ----------------------------------------------------------------- opens */

    /**
     * The `POST …/open` routes. They answer `{ opened }` rather than failing when no editor is
     * installed — common in the dev container — so the toast distinguishes the two.
     */
    openChapter = async (chapterId: string): Promise<void> =>
        await this.open(`/chapter/${encodeURIComponent(chapterId)}/open`, _('Chapter %s', chapterId));

    openLocation = async (locationId: string): Promise<void> =>
        await this.open(`/location/${encodeURIComponent(locationId)}/open`, _('Location %s', locationId));

    openMap = async (mapId: string): Promise<void> =>
        await this.open(`/map/${encodeURIComponent(mapId)}/open`, _('Map %s', mapId));

    openPassage = async (passageId: string, type: TPassageSummary['type'] = 'screen'): Promise<void> =>
        await this.open(
            `/passage/${encodeURIComponent(type)}/${encodeURIComponent(passageId)}/open`,
            _('Passage %s', passageId)
        );

    private open = async (path: string, label: string): Promise<void> => {
        try {
            const result = await HttpErrorHandler.fetchWithErrorHandling<{ opened: boolean; file: string }>(
                this.endpoint(path),
                { method: 'POST' },
                `open ${label}`
            );

            if (result.opened) {
                showToast(_('%s opened in the editor', label), { variant: 'success' });
            } else {
                // The server found the file but could not launch an editor. Showing the path is
                // the useful answer: the author can open it themselves.
                showToast(_('No editor available — the file is %s', result.file), { variant: 'info' });
            }
        } catch (error) {
            showToast(errorMessage(error, _('Could not open %s', label)), { variant: 'error' });
        }
    };

    /* ----------------------------------------------------------- map & location */

    /**
     * `PUT /api/location/:id` with just the shape — the map tab's save path (§4.2).
     *
     * `shape: null` takes the location off the map; **omitting** it would leave the polygon
     * alone. The two are different on the wire and the server honours the difference, so the
     * parameter is `| null` rather than optional.
     */
    updateLocationShape = async (
        locationId: string,
        shape: {
            mapId: string;
            points: { x: number; y: number }[];
            color: string;
            z?: number;
        } | null,
        hash?: string
    ): Promise<TLocationSummary> =>
        await HttpErrorHandler.fetchWithErrorHandling<TLocationSummary>(
            this.endpoint(`/location/${encodeURIComponent(locationId)}`),
            {
                method: 'PUT',
                body: JSON.stringify({ shape }),
                headers: withIfMatch(hash),
            },
            `save location ${locationId}`
        );

    /** `PUT /api/location/:id` for the location form's own fields. */
    updateLocation = async (
        locationId: string,
        fields: { name?: string; description?: string },
        hash?: string
    ): Promise<TLocationSummary> =>
        await HttpErrorHandler.fetchWithErrorHandling<TLocationSummary>(
            this.endpoint(`/location/${encodeURIComponent(locationId)}`),
            { method: 'PUT', body: JSON.stringify(fields), headers: withIfMatch(hash) },
            `save location ${locationId}`
        );

    /** `PUT /api/map/:id` — the map's own notes and strokes (§4.3). */
    updateMap = async (
        mapId: string,
        fields: {
            title?: string;
            size?: { width: number; height: number };
            notes?: {
                id: string;
                text: string;
                position: { x: number; y: number };
                rotation?: number;
                color?: string;
            }[];
            strokes?: { id: string; color: string; width: number; points: number[] }[];
        },
        hash?: string
    ): Promise<TMapSummary> =>
        await HttpErrorHandler.fetchWithErrorHandling<TMapSummary>(
            this.endpoint(`/map/${encodeURIComponent(mapId)}`),
            { method: 'PUT', body: JSON.stringify(fields), headers: withIfMatch(hash) },
            `save map ${mapId}`
        );

    /**
     * `DELETE /api/passage/:type/:id`.
     *
     * Distinct from the older `deletePassage` above, which swallows errors into a toast. The
     * graph needs the *result* — the server reports which passages still link to the one that
     * was deleted, and that list is the whole value of the call.
     */
    deletePassageTyped = async (
        passageId: string,
        type: TPassageSummary['type']
    ): Promise<{ deleted: string; file: string; referencedBy: string[] }> =>
        await HttpErrorHandler.fetchWithErrorHandling<{ deleted: string; file: string; referencedBy: string[] }>(
            this.endpoint(`/passage/${encodeURIComponent(type)}/${encodeURIComponent(passageId)}`),
            { method: 'DELETE' },
            `delete passage ${passageId}`
        );

    /**
     * `POST /api/chapter/:id/setTime` — a chapter's time range, in seconds.
     *
     * Seconds rather than a formatted string: `Time` is seconds internally, the server writes
     * `Time.fromS(n)`, and the timeline's world x *is* the second. Formatting it on the way out
     * and parsing it on the way in would be two chances to disagree about a calendar.
     */
    setChapterTimeRange = async (
        chapterId: string,
        start: number,
        end: number,
        hash?: string
    ): Promise<TChapterSummary> =>
        await HttpErrorHandler.fetchWithErrorHandling<TChapterSummary>(
            this.endpoint(`/chapter/${encodeURIComponent(chapterId)}/setTime`),
            { method: 'POST', body: JSON.stringify({ start, end }), headers: withIfMatch(hash) },
            `set the time of ${chapterId}`
        );

    /** `PUT /api/chapter/:id/layout` — passage positions (§4.4). */
    updateChapterLayout = async (
        chapterId: string,
        layout: Record<string, { x: number; y: number }>,
        hash?: string
    ): Promise<TChapterSummary> =>
        await HttpErrorHandler.fetchWithErrorHandling<TChapterSummary>(
            this.endpoint(`/chapter/${encodeURIComponent(chapterId)}/layout`),
            { method: 'PUT', body: JSON.stringify({ layout }), headers: withIfMatch(hash) },
            `save layout for ${chapterId}`
        );

    /* ----------------------------------------------------------------- writes */

    /**
     * Everything below still talks to routes the server answers with `501` until Phase 5, and
     * the map pair is still shaped around the tile model that Phase 6 replaces. They are kept
     * working so the existing forms keep compiling; each one is rewritten in the phase that
     * gives it a real endpoint.
     */

    updateChapter = async (chapterId: string, data: TChapterData): Promise<void> => {
        try {
            await HttpErrorHandler.fetchWithErrorHandling(
                this.endpoint(`/chapter/${encodeURIComponent(chapterId)}`),
                {
                    method: 'PUT',
                    body: JSON.stringify(TypeConverters.chapterDataToUpdateRequest(data)),
                    headers: { 'Content-Type': 'application/json' },
                },
                `update chapter ${chapterId}`
            );
            showToast(_('Chapter %s saved', chapterId), { variant: 'success' });
        } catch (error) {
            showToast(errorMessage(error, _('Failed to save chapter %s', chapterId)), { variant: 'error' });
        }
    };

    deleteChapter = async (chapterId: string): Promise<void> => {
        try {
            await HttpErrorHandler.fetchWithErrorHandling(
                this.endpoint(`/chapter/${encodeURIComponent(chapterId)}`),
                { method: 'DELETE' },
                `delete chapter ${chapterId}`
            );
            showToast(_('Chapter %s deleted', chapterId), { variant: 'success' });
        } catch (error) {
            showToast(errorMessage(error, _('Failed to delete chapter %s', chapterId)), { variant: 'error' });
        }
    };

    setChapterTime = async (chapterId: string, data: { timeRange: { start: string; end: string } }): Promise<void> => {
        try {
            await HttpErrorHandler.fetchWithErrorHandling(
                this.endpoint(`/chapter/${encodeURIComponent(chapterId)}/setTime`),
                {
                    method: 'POST',
                    body: JSON.stringify(TypeConverters.createSetTimeRequest(data.timeRange)),
                    headers: { 'Content-Type': 'application/json' },
                },
                `set time for chapter ${chapterId}`
            );
        } catch (error) {
            showToast(errorMessage(error, _('Failed to set time for chapter %s', chapterId)), { variant: 'error' });
        }
    };

    addScreenPassage = async (passageId: string, data: TScreenPassageData): Promise<void> => {
        try {
            await HttpErrorHandler.fetchWithErrorHandling(
                this.endpoint(`/passage/screen/${encodeURIComponent(passageId)}`),
                {
                    method: 'PUT',
                    body: JSON.stringify(TypeConverters.screenPassageDataToUpdateRequest(data)),
                    headers: { 'Content-Type': 'application/json' },
                },
                `save passage ${passageId}`
            );
            showToast(_('Passage %s saved', passageId), { variant: 'success' });
        } catch (error) {
            showToast(errorMessage(error, _('Failed to save passage %s', passageId)), { variant: 'error' });
        }
    };

    deletePassage = async (passageId: string, type: TPassageSummary['type'] = 'screen'): Promise<void> => {
        try {
            await HttpErrorHandler.fetchWithErrorHandling(
                this.endpoint(`/passage/${encodeURIComponent(type)}/${encodeURIComponent(passageId)}`),
                { method: 'DELETE' },
                `delete passage ${passageId}`
            );
            showToast(_('Passage %s deleted', passageId), { variant: 'success' });
        } catch (error) {
            showToast(errorMessage(error, _('Failed to delete passage %s', passageId)), { variant: 'error' });
        }
    };

    setPassageTime = async (passageId: string, data: { timeRange: { start: string; end: string } }): Promise<void> => {
        try {
            await HttpErrorHandler.fetchWithErrorHandling(
                this.endpoint(`/passage/screen/${encodeURIComponent(passageId)}/setTime`),
                {
                    method: 'POST',
                    body: JSON.stringify(TypeConverters.createSetTimeRequest(data.timeRange)),
                    headers: { 'Content-Type': 'application/json' },
                },
                `set time for passage ${passageId}`
            );
        } catch (error) {
            showToast(errorMessage(error, _('Failed to set time for passage %s', passageId)), { variant: 'error' });
        }
    };
}

/**
 * JSON headers plus `If-Match` when there is a hash to send (§5.3's optimistic concurrency).
 *
 * Omitted rather than sent empty when there is none: the server treats an absent `If-Match` as
 * "not participating" and an empty one would be a hash that matches nothing, i.e. a guaranteed
 * `409` on the first save of a file the client has not read.
 */
const withIfMatch = (hash?: string): Record<string, string> =>
    hash ? { 'Content-Type': 'application/json', 'If-Match': hash } : { 'Content-Type': 'application/json' };

const errorMessage = (error: unknown, fallback: string): string =>
    error instanceof Error && error.message ? error.message : fallback;
