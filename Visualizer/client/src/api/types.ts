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
    TPassageDto,
    TProjectDto,
    TSourceDto,
    TSourceOwner,
    TStoryInfoDto,
    TTimelineLayoutDto,
    TTriggerDto,
    TUpdateChapterBody,
    TUpdateChapterLayoutBody,
    TUpdateEntityBody,
    TUpdateMapBody,
    TUpdatePassageBody,
    TUpdateSourceBody,
    TUpdateTimelineLayoutBody,
    TUpdateTriggerBody,
    TUploadImageBody,
    TVersionedBody,
} from '@story/visualizer-protocol';

export type TVisualizerApi = {
    health(): Promise<THealthDto>;
    login(password: string): Promise<void>;
    getStoryInfo(): Promise<TStoryInfoDto>;
    getProject(): Promise<TProjectDto>;

    createChapter(body: TCreateChapterBody): Promise<TChapterDto>;
    getChapter(chapterId: string): Promise<TChapterDto>;
    updateChapter(chapterId: string, body: TUpdateChapterBody): Promise<TChapterDto>;
    deleteChapter(chapterId: string, body: TVersionedBody): Promise<TOkDto>;
    addChapterCharacter(chapterId: string, body: TAddChapterCharacterBody): Promise<TChapterDto>;
    removeChapterCharacter(chapterId: string, characterId: string, body: TVersionedBody): Promise<TChapterDto>;

    listChapterPassages(chapterId: string): Promise<TChapterPassagesDto>;
    createPassage(chapterId: string, body: TCreatePassageBody): Promise<TPassageDto>;
    getPassage(passageId: string): Promise<TPassageDto>;
    updatePassage(passageId: string, body: TUpdatePassageBody): Promise<TPassageDto>;
    deletePassage(passageId: string, body: TVersionedBody): Promise<TOkDto>;

    createTrigger(chapterId: string, body: TCreateTriggerBody): Promise<TTriggerDto>;
    getTrigger(triggerId: string): Promise<TTriggerDto>;
    updateTrigger(triggerId: string, body: TUpdateTriggerBody): Promise<TTriggerDto>;
    deleteTrigger(triggerId: string, body: TVersionedBody): Promise<TOkDto>;

    listEntities<K extends TEntityKind>(kind: K): Promise<TEntityListDto<K>>;
    createEntity<K extends TEntityKind>(kind: K, body: TCreateEntityBody<K>): Promise<TEntityDtoByKind[K]>;
    getEntity<K extends TEntityKind>(kind: K, id: string): Promise<TEntityDtoByKind[K]>;
    updateEntity<K extends TEntityKind>(kind: K, id: string, body: TUpdateEntityBody<K>): Promise<TEntityDtoByKind[K]>;
    deleteEntity(kind: TEntityKind, id: string, body: TVersionedBody): Promise<TOkDto>;

    getSource(owner: TSourceOwner, id: string): Promise<TSourceDto>;
    updateSource(owner: TSourceOwner, id: string, body: TUpdateSourceBody): Promise<TSourceDto>;

    getImage(owner: TImageOwner, id: string): Promise<TImageDto>;
    uploadImage(owner: TImageOwner, id: string, body: TUploadImageBody): Promise<TImageDto>;

    getMap(mapId: string): Promise<TMapDto>;
    updateMap(mapId: string, body: TUpdateMapBody): Promise<TMapDto>;

    getTimelineLayout(): Promise<TTimelineLayoutDto>;
    updateTimelineLayout(body: TUpdateTimelineLayoutBody): Promise<TTimelineLayoutDto>;
    getChapterLayout(chapterId: string): Promise<TChapterLayoutDto>;
    updateChapterLayout(chapterId: string, body: TUpdateChapterLayoutBody): Promise<TChapterLayoutDto>;
};
