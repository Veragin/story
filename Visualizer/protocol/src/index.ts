/**
 * `@story/visualizer-protocol` — the contract between `Visualizer/client` and
 * `Visualizer/server` (plan §1.1 "API contract"): route constants and builders (`routes.ts`) and
 * the DTO of every resource (`dto/*.ts`).
 *
 * Layering: imports `@story/shared` only (plus `@story/types` type-only, if ever needed). No
 * service may be imported from here; both Visualizer halves import this.
 */

/* ROUTES, TRouteName, TRouteParams, TApiSpec, TRouteBody, TRouteResponse, buildPath, matchPath,
   API_PREFIX, CREATED_ROUTES, THttpMethod */
export * from './routes';

/* TCode, TMaybeCode, isCode, code, TValue, TValueRecord, TVersion, EMPTY_VERSION, TVersioned,
   TVersionedBody, TSourceRef, TTimeString, TTimeRangeDto, TDeltaTimeDto, isDeltaTime, TOkDto, TOpenDto */
export * from './dto/common';
/* THealthDto, TProjectDto, TProjectEntryDto, TProjectChapterDto */
export * from './dto/project';
/* TChapterDto, TChapterChildDto, TChapterCharacterDto, TDataTypeDto, TChapterEditable,
   TCreateChapterBody, TUpdateChapterBody, TDeleteChapterBody, TAddChapterCharacterBody,
   TRemoveChapterCharacterBody */
export * from './dto/chapter';
/* TPassageType, TPassageDto, TScreenPassageDto, TLinearPassageDto, TTransitionPassageDto,
   TBodyItemDto, TLinkDto, TLinkCostDto, TLinkCostObjectDto, TPassageEdgeDto, TChapterPassagesDto,
   TPassageEditable, TCreatePassageBody, TUpdatePassageBody, TDeletePassageBody */
export * from './dto/passage';
/* TTriggerDto, TTriggerEditable, TCreateTriggerBody, TUpdateTriggerBody, TDeleteTriggerBody */
export * from './dto/trigger';
/* ENTITY_KINDS, TEntityKind, isEntityKind, TCharacterDto, TNpcDto, TLocationDto, TItemDto,
   TLocalCharacterDto, TInventoryEntryDto, TItemSource, TEntityDtoByKind, TEntityDto,
   TEntityEditable, TCreateEntityBody, TUpdateEntityBody, TDeleteEntityBody, TEntityListDto */
export * from './dto/entity';
/* IMAGE_OWNERS, TImageOwner, isImageOwner, TImageDto, TUploadImageBody, MAX_IMAGE_BYTES,
   PNG_SIGNATURE */
export * from './dto/image';
/* GLOBAL_MAP_ID, TMapDto, TMapFile, TMapTileDto, TPaletteEntryDto, TLocationShapeDto,
   TSubMapRefDto, TColorId, TUpdateMapBody */
export * from './dto/map';
/* TTimelineLayoutDto, TTimelineLayoutFile, TUpdateTimelineLayoutBody, TChapterLayoutDto,
   TChapterLayoutFile, TUpdateChapterLayoutBody */
export * from './dto/layout';
/* RESOURCE_KINDS, TResourceKind, SSE_EVENT, TChangeEvent, THelloEvent, eventIds, isWildcardId */
export * from './dto/events';
/* TApiErrorCode, TApiErrorBody, TDiagnosticDto, TReferenceDto, ERROR_STATUS */
export * from './dto/errors';
