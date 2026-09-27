import type {
    TAddChapterCharacterBody,
    TChapterDto,
    TChapterLayoutDto,
    TChapterPassagesDto,
    TCreateChapterBody,
    TCreateEntityBody,
    TCreatePassageBody,
    TCreateTriggerBody,
    TEntityDtoByKind,
    TEntityKind,
    TEntityListDto,
    THealthDto,
    TImageDto,
    TImageOwner,
    TMapDto,
    TOkDto,
    TOpenDto,
    TPassageDto,
    TProjectDto,
    TTimelineLayoutDto,
    TTriggerDto,
    TUpdateChapterBody,
    TUpdateChapterLayoutBody,
    TUpdateEntityBody,
    TUpdateMapBody,
    TUpdatePassageBody,
    TUpdateTimelineLayoutBody,
    TUpdateTriggerBody,
    TUploadImageBody,
    TVersionedBody,
} from '@story/visualizer-protocol';

/**
 * The Visualizer API as the pages see it — one method per protocol route (`ROUTES` in
 * `@story/visualizer-protocol`, same names). Two implementations:
 *
 *  - `httpApi` (`createHttpApi`) — talks to `Visualizer/server` through the Vite `/api` proxy;
 *  - `mockApi` (`createMockApi`) — in memory, seeded with a copy of the sample story, for pages
 *    built before the server's handlers exist (WP2) and for tests.
 *
 * Every method rejects with an `ApiError` on a non-2xx answer. Mutations resolve with the
 * resource's new DTO (and so its new `version`), which you keep for the next PUT / DELETE.
 */
export interface TVisualizerApi {
    health(): Promise<THealthDto>;
    getProject(): Promise<TProjectDto>;

    createChapter(body: TCreateChapterBody): Promise<TChapterDto>;
    getChapter(chapterId: string): Promise<TChapterDto>;
    updateChapter(chapterId: string, body: TUpdateChapterBody): Promise<TChapterDto>;
    deleteChapter(chapterId: string, body: TVersionedBody): Promise<TOkDto>;
    openChapter(chapterId: string): Promise<TOpenDto>;
    addChapterCharacter(chapterId: string, body: TAddChapterCharacterBody): Promise<TChapterDto>;
    removeChapterCharacter(chapterId: string, characterId: string, body: TVersionedBody): Promise<TChapterDto>;

    listChapterPassages(chapterId: string): Promise<TChapterPassagesDto>;
    createPassage(chapterId: string, body: TCreatePassageBody): Promise<TPassageDto>;
    getPassage(passageId: string): Promise<TPassageDto>;
    updatePassage(passageId: string, body: TUpdatePassageBody): Promise<TPassageDto>;
    deletePassage(passageId: string, body: TVersionedBody): Promise<TOkDto>;
    openPassage(passageId: string): Promise<TOpenDto>;

    createTrigger(chapterId: string, body: TCreateTriggerBody): Promise<TTriggerDto>;
    getTrigger(triggerId: string): Promise<TTriggerDto>;
    updateTrigger(triggerId: string, body: TUpdateTriggerBody): Promise<TTriggerDto>;
    deleteTrigger(triggerId: string, body: TVersionedBody): Promise<TOkDto>;

    listEntities<K extends TEntityKind>(kind: K): Promise<TEntityListDto<K>>;
    createEntity<K extends TEntityKind>(kind: K, body: TCreateEntityBody<K>): Promise<TEntityDtoByKind[K]>;
    getEntity<K extends TEntityKind>(kind: K, id: string): Promise<TEntityDtoByKind[K]>;
    updateEntity<K extends TEntityKind>(kind: K, id: string, body: TUpdateEntityBody<K>): Promise<TEntityDtoByKind[K]>;
    deleteEntity(kind: TEntityKind, id: string, body: TVersionedBody): Promise<TOkDto>;

    /** Story art: the `.png` next to a passage / character / npc file (protocol `dto/image.ts`). */
    getImage(owner: TImageOwner, id: string): Promise<TImageDto>;
    uploadImage(owner: TImageOwner, id: string, body: TUploadImageBody): Promise<TImageDto>;

    getMap(mapId: string): Promise<TMapDto>;
    updateMap(mapId: string, body: TUpdateMapBody): Promise<TMapDto>;

    getTimelineLayout(): Promise<TTimelineLayoutDto>;
    updateTimelineLayout(body: TUpdateTimelineLayoutBody): Promise<TTimelineLayoutDto>;
    getChapterLayout(chapterId: string): Promise<TChapterLayoutDto>;
    updateChapterLayout(chapterId: string, body: TUpdateChapterLayoutBody): Promise<TChapterLayoutDto>;
}
