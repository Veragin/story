import type { TFunctionDto, TMaybeCode, TSourceRef, TTimeString, TVersioned, TVersionedBody } from './common';

/** Ids are unique across the story. `version` is the hash of the chapter's `triggers.ts`. */
export type TTriggerDto = TVersioned &
    TSourceRef & {
        triggerId: string;
        chapterId: string;
        /** The trigger id when the source has none. */
        name: TMaybeCode<string>;
        description: TMaybeCode<string>;
        time: TMaybeCode<TTimeString>;
        condition: TFunctionDto;
        action: TFunctionDto;
    };

export type TTriggerEditable = Pick<TTriggerDto, 'name' | 'description' | 'time' | 'condition' | 'action'>;

export type TCreateTriggerBody = {
    triggerId: string;
    name: string;
    description?: string;
    time: TTimeString;
};

/** Omitted fields are left untouched. */
export type TUpdateTriggerBody = TVersionedBody & Partial<TTriggerEditable>;

export type TDeleteTriggerBody = TVersionedBody;
