import type {
    TAddChapterCharacterBody,
    TCatalogEntryDto,
    TCatalogListDto,
    TClearedReferencesDto,
    TCreateCatalogEntryBody,
    TDeleteReferencesDto,
    TAddLiteralValueBody,
    TChapterDto,
    TChapterLayoutDto,
    TChapterPassagesDto,
    TCreateChapterBody,
    TCreateEntityBody,
    TCreateLiteralBody,
    TCreatePassageBody,
    TCreateTriggerBody,
    TCreateTypeBody,
    TDeleteGitBranchBody,
    TDeleteGitConfigBody,
    TDeleteMapBody,
    TEditStoryInfoDto,
    TEngineSection,
    TEngineSectionDto,
    TEntityDtoByKind,
    TEntityKind,
    TEntityListDto,
    TGitBranchDto,
    TGitCheckoutBody,
    TGitCommitBody,
    TGitCommitResultDto,
    TGitDto,
    TGitPullResultDto,
    TGitStatusDto,
    THealthDto,
    TLiteralDto,
    TImageDto,
    TImageOwner,
    TMapDto,
    TOkDto,
    TPassageDto,
    TProjectDto,
    TSetupGitBody,
    TSourceDto,
    TSourceOwner,
    TStoryAccessDto,
    TStoryInfoDto,
    TStructTypeDto,
    TStructureDto,
    TTimelineLayoutDto,
    TTriggerDto,
    TUpdateChapterBody,
    TUpdateChapterLayoutBody,
    TUpdateEngineSectionBody,
    TUpdateCatalogEntryBody,
    TUpdateEntityBody,
    TUpdateGitConfigBody,
    TUpdateLiteralBody,
    TUpdateMapBody,
    TUpdatePassageBody,
    TUpdateSourceBody,
    TUpdateStoryBody,
    TUpdateTimelineLayoutBody,
    TUpdateTriggerBody,
    TUpdateTypeBody,
    TUpdateTypeDto,
    TUploadImageBody,
    TVersionedBody,
} from '@story/protocol';

export type TVisualizerApi = {
    health(): Promise<THealthDto>;
    login(password: string): Promise<void>;
    getStoryInfo(): Promise<TStoryInfoDto>;
    updateStoryInfo(body: TUpdateStoryBody): Promise<TEditStoryInfoDto>;
    requestPasswordReset(email: string): Promise<void>;
    getStoryAccess(): Promise<TStoryAccessDto>;
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
    deleteEntity(kind: TEntityKind, id: string, body: TVersionedBody): Promise<TClearedReferencesDto>;
    getEntityReferences(kind: TEntityKind, id: string): Promise<TDeleteReferencesDto>;

    getStructure(): Promise<TStructureDto>;
    createType(body: TCreateTypeBody): Promise<TStructTypeDto>;
    updateType(name: string, body: TUpdateTypeBody): Promise<TUpdateTypeDto>;
    deleteType(name: string, body: TVersionedBody): Promise<TOkDto>;
    createLiteral(body: TCreateLiteralBody): Promise<TLiteralDto>;
    updateLiteral(name: string, body: TUpdateLiteralBody): Promise<TLiteralDto>;
    addLiteralValue(name: string, body: TAddLiteralValueBody): Promise<TLiteralDto>;
    deleteLiteral(name: string, body: TVersionedBody): Promise<TOkDto>;

    listCatalogEntries(name: string): Promise<TCatalogListDto>;
    createCatalogEntry(name: string, body: TCreateCatalogEntryBody): Promise<TCatalogEntryDto>;
    getCatalogEntry(name: string, id: string): Promise<TCatalogEntryDto>;
    updateCatalogEntry(name: string, id: string, body: TUpdateCatalogEntryBody): Promise<TCatalogEntryDto>;
    deleteCatalogEntry(name: string, id: string, body: TVersionedBody): Promise<TClearedReferencesDto>;
    getCatalogEntryReferences(name: string, id: string): Promise<TDeleteReferencesDto>;

    getSource(owner: TSourceOwner, id: string): Promise<TSourceDto>;
    updateSource(owner: TSourceOwner, id: string, body: TUpdateSourceBody): Promise<TSourceDto>;

    getEngineSection(section: TEngineSection): Promise<TEngineSectionDto>;
    updateEngineSection(section: TEngineSection, body: TUpdateEngineSectionBody): Promise<TEngineSectionDto>;

    getImage(owner: TImageOwner, id: string): Promise<TImageDto>;
    uploadImage(owner: TImageOwner, id: string, body: TUploadImageBody): Promise<TImageDto>;
    deleteImage(owner: TImageOwner, id: string, body: TVersionedBody): Promise<TImageDto>;

    getMap(mapId: string): Promise<TMapDto>;
    updateMap(mapId: string, body: TUpdateMapBody): Promise<TMapDto>;
    deleteMap(mapId: string, body: TDeleteMapBody): Promise<TOkDto>;

    getTimelineLayout(): Promise<TTimelineLayoutDto>;
    updateTimelineLayout(body: TUpdateTimelineLayoutBody): Promise<TTimelineLayoutDto>;
    getChapterLayout(chapterId: string): Promise<TChapterLayoutDto>;
    updateChapterLayout(chapterId: string, body: TUpdateChapterLayoutBody): Promise<TChapterLayoutDto>;

    getGit(): Promise<TGitDto>;
    updateGitConfig(body: TUpdateGitConfigBody): Promise<TGitDto>;
    setupGit(body: TSetupGitBody): Promise<TGitDto>;
    deleteGitConfig(body: TDeleteGitConfigBody): Promise<void>;
    gitFetch(): Promise<TGitStatusDto>;
    gitCommit(body: TGitCommitBody): Promise<TGitCommitResultDto>;
    gitPush(): Promise<TGitStatusDto>;
    gitForcePush(): Promise<TGitStatusDto>;
    gitPull(): Promise<TGitPullResultDto>;
    gitCheckout(body: TGitCheckoutBody): Promise<TGitStatusDto>;
    gitDiscard(): Promise<TGitStatusDto>;
    getGitBranches(): Promise<TGitBranchDto[]>;
    deleteGitBranch(body: TDeleteGitBranchBody): Promise<TGitStatusDto>;
};
