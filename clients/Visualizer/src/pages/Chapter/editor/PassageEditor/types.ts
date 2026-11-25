import type { TDiagnosticDto, TPassageDto } from '@story/protocol';
import type { TOption } from '../../../../structure/option';
import type { TVisualizerApi } from '../../../../api';

export type TDiag = (path: string) => TDiagnosticDto[];

type TEditFn = (mutate: (draft: TPassageDto) => void) => void;

export type TPassageCreator = {
    idPrefix: string;
    create: (localId: string) => Promise<boolean>;
};

export type TOptionsProps = {
    passageOptions: TOption[];
    itemOptions: TOption[];
    passageCreator?: TPassageCreator;
};

export type TFieldsProps<D extends TPassageDto = TPassageDto> = TOptionsProps & {
    draft: D;
    finishOptions: TOption[];
    edit: TEditFn;
    diag: TDiag;
    api?: TVisualizerApi;
    preamble?: string;
};

export type TListProps<T> = TOptionsProps & {
    items: T[];
    onChange: (items: T[]) => void;
    diag: TDiag;
};
