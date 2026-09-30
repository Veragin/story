import type { TDiagnosticDto, TPassageDto } from '@story/visualizer-protocol';
import type { TOption } from '../../../../components/CodeField';
import type { TVisualizerApi } from '../../../../api';

/** The diagnostics of one field path (`title`, `body.0.links.1.text`, …). */
export type TDiag = (path: string) => TDiagnosticDto[];

/** Mutates the draft (`PassageEditorStore.edit`). */
export type TEditFn = (mutate: (draft: TPassageDto) => void) => void;

/** The pickers' options, passed down to every field that needs them. */
export type TOptionsProps = {
    /** Passage ids offered by the pickers (the chapter's passages). */
    passageOptions: TOption[];
    itemOptions: TOption[];
};

export type TFieldsProps<D extends TPassageDto = TPassageDto> = TOptionsProps & {
    draft: D;
    edit: TEditFn;
    diag: TDiag;
    /** The api the passage's image is loaded / uploaded through (the page's). */
    api?: TVisualizerApi;
    /** The passage's statements before its `return` on disk (`base.preamble`, read-only). */
    preamble?: string;
};

export type TListProps<T> = TOptionsProps & {
    items: T[];
    onChange: (items: T[]) => void;
    diag: TDiag;
};
