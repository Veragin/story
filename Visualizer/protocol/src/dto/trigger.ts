import type { TCode, TMaybeCode, TSourceRef, TTimeString, TVersioned, TVersionedBody } from './common';

/**
 * A time trigger — an exported `TTimeTrigger` (`types/TTimeTrigger.ts`) declared in
 * `data/chapters/<ch>/triggers.ts` and listed in the chapter's `triggers: [...]`.
 * Trigger ids are unique across the whole story (the route is `/api/triggers/:triggerId`).
 * `version` is the hash of `triggers.ts` (the file holds every trigger of the chapter).
 */
export type TTriggerDto = TVersioned &
    TSourceRef & {
        triggerId: string;
        chapterId: string;
        /**
         * Required once WP2 adds `name: string` to `TTimeTrigger` (plan §1.1). Until a trigger
         * has one, readers return its id.
         */
        name: TMaybeCode<string>;
        description: TMaybeCode<string>;
        /** `Time.fromString('1.12 0:0')` → `'1.12 0:0'`. */
        time: TMaybeCode<TTimeString>;
        /** Functions in the source — always code. */
        condition: TCode;
        action: TCode;
    };

export type TTriggerEditable = Pick<TTriggerDto, 'name' | 'description' | 'time' | 'condition' | 'action'>;

/** `POST /api/chapters/:chapterId/triggers` */
export type TCreateTriggerBody = {
    triggerId: string;
    name: string;
    description?: string;
    time: TTimeString;
};

/** `PUT /api/triggers/:triggerId` — omitted fields are left untouched. */
export type TUpdateTriggerBody = TVersionedBody & Partial<TTriggerEditable>;

/** `DELETE /api/triggers/:triggerId` */
export type TDeleteTriggerBody = TVersionedBody;
